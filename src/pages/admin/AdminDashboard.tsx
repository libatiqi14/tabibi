import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  deleteReviewAdmin,
  getAdminStats,
  getAppointmentsAdmin,
  getDoctorsAdmin,
  getPatientsAdmin,
  getPlatformAnalytics,
  getReviewsAdmin,
  toggleDoctorStatus,
  type AdminAppointment,
  type AdminAppointmentFilter,
  type AdminDoctor,
  type AdminPatient,
  type AdminPlatformAnalytics,
  type AdminReview,
  type AdminStats,
} from '../../services/admin'

const dateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const monthFormatter = new Intl.DateTimeFormat('ar-MA', {
  month: 'short',
  year: 'numeric',
})

const appointmentFilters: Array<{
  value: AdminAppointmentFilter
  label: string
}> = [
  { value: 'all', label: 'الكل' },
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'completed', label: 'المكتملة' },
  { value: 'cancelled', label: 'الملغية' },
]

const statusLabels: Record<string, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

function formatRating(value: number | null) {
  return value == null ? 'لا توجد' : value.toFixed(1)
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

function formatList(items: string[] | null) {
  return items && items.length > 0 ? items.join('، ') : 'غير متوفر'
}

function SectionShell({
  title,
  description,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string
  description: string
  icon: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
      >
        <span className="flex items-start gap-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span>
            <span className="block text-xl font-bold tracking-normal text-slate-950">
              {title}
            </span>
            <span className="mt-2 block text-sm leading-7 text-slate-600">
              {description}
            </span>
          </span>
        </span>

        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
          {open ? '⌃' : '⌄'}
        </span>
      </button>

      {open ? <div className="mt-5">{children}</div> : null}
    </section>
  )
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [analytics, setAnalytics] = useState<AdminPlatformAnalytics | null>(null)
  const [appointmentFilter, setAppointmentFilter] =
    useState<AdminAppointmentFilter>('all')
  const [loading, setLoading] = useState(true)
  const [updatingDoctorId, setUpdatingDoctorId] = useState<string | null>(null)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedDoctorProfile, setSelectedDoctorProfile] =
    useState<AdminDoctor | null>(null)
  const [viewedPatient, setViewedPatient] = useState<AdminPatient | null>(null)
  const [openSections, setOpenSections] = useState({
    stats: true,
    doctors: false,
    patients: false,
    appointments: false,
    reviews: false,
    analytics: false,
  })

  const maxAppointmentsByMonth = Math.max(
    1,
    ...(analytics?.appointmentsByMonth.map((item) => item.count) ?? [0]),
  )
  const maxUsersByMonth = Math.max(
    1,
    ...(analytics?.newUsersByMonth.map((item) => item.count) ?? [0]),
  )
  const maxSpecialtyCount = Math.max(
    1,
    ...(analytics?.doctorsBySpecialty.map((item) => item.count) ?? [0]),
  )
  const maxRatingCount = Math.max(
    1,
    ...([1, 2, 3, 4, 5] as const).map(
      (rating) => analytics?.ratingsDistribution[rating] ?? 0,
    ),
  )

  const overviewCards = useMemo(
    () => [
      {
        label: '👥 إجمالي المرضى',
        value: stats?.totalPatients ?? 0,
        color: 'text-slate-950',
      },
      {
        label: '👨‍⚕️ إجمالي الأطباء',
        value: stats?.totalDoctors ?? 0,
        color: 'text-teal-700',
      },
      {
        label: '📅 إجمالي المواعيد',
        value: stats?.totalAppointments ?? 0,
        color: 'text-slate-950',
      },
      {
        label: '⭐ إجمالي التقييمات',
        value: stats?.totalReviews ?? 0,
        color: 'text-amber-600',
      },
      {
        label: '🔔 إجمالي الإشعارات',
        value: stats?.totalNotifications ?? 0,
        color: 'text-slate-950',
      },
      {
        label: '📊 متوسط تقييم المنصة',
        value: stats ? formatRating(stats.averagePlatformRating) : '...',
        color: 'text-emerald-700',
      },
    ],
    [stats],
  )

  const loadDashboard = async (filter: AdminAppointmentFilter) => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [
        nextStats,
        nextDoctors,
        nextPatients,
        nextAppointments,
        nextReviews,
        nextAnalytics,
      ] = await Promise.all([
        getAdminStats(),
        getDoctorsAdmin(),
        getPatientsAdmin(),
        getAppointmentsAdmin(filter),
        getReviewsAdmin(),
        getPlatformAnalytics(),
      ])

      setStats(nextStats)
      setDoctors(nextDoctors)
      setPatients(nextPatients)
      setAppointments(nextAppointments)
      setReviews(nextReviews)
      setAnalytics(nextAnalytics)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل لوحة تحكم الإدارة. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard(appointmentFilter)
  }, [appointmentFilter])

  useEffect(() => {
    if (!selectedDoctorProfile) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDoctorProfile(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDoctorProfile])

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [section]: !currentSections[section],
    }))
  }

  const handleToggleDoctorStatus = async (doctor: AdminDoctor) => {
    setUpdatingDoctorId(doctor.id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const nextActive = !doctor.active

      await toggleDoctorStatus(doctor.id, nextActive)

      setDoctors((currentDoctors) =>
        currentDoctors.map((currentDoctor) =>
          currentDoctor.id === doctor.id
            ? { ...currentDoctor, active: nextActive }
            : currentDoctor,
        ),
      )
      setSelectedDoctorProfile((currentDoctor) =>
        currentDoctor?.id === doctor.id
          ? { ...currentDoctor, active: nextActive }
          : currentDoctor,
      )
      setSuccessMessage(
        nextActive ? 'تم تفعيل الطبيب بنجاح' : 'تم تعطيل الطبيب بنجاح',
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحديث حالة الطبيب. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setUpdatingDoctorId(null)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    const confirmed = window.confirm('هل تريد حذف هذا التقييم؟')

    if (!confirmed) {
      return
    }

    setDeletingReviewId(reviewId)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await deleteReviewAdmin(reviewId)
      setReviews((currentReviews) =>
        currentReviews.filter((review) => review.id !== reviewId),
      )
      setSuccessMessage('تم حذف التقييم بنجاح.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر حذف التقييم. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setDeletingReviewId(null)
    }
  }

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-lg font-black text-teal-700 ring-1 ring-teal-100">
              T
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-teal-700">Tabibi</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                لوحة الإدارة
              </h1>
            <p className="mt-2 text-sm text-slate-600">
              {profile?.email ?? 'حساب الإدارة'}
            </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            تسجيل الخروج
          </button>
        </header>

        {errorMessage ? (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <SectionShell
          title="الإحصائيات"
          description="نظرة عامة على أداء المنصة والمستخدمين."
          icon="📊"
          open={openSections.stats}
          onToggle={() => toggleSection('stats')}
        >
          {loading ? (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              جاري تحميل الإحصائيات...
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {overviewCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold text-slate-600">
                    {card.label}
                  </p>
                  <p className={`mt-3 text-2xl font-bold ${card.color}`}>
                    {card.value}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="الأطباء"
          description="إدارة حسابات الأطباء وحالة ظهورهم للمرضى."
          icon="👨‍⚕️"
          open={openSections.doctors}
          onToggle={() => toggleSection('doctors')}
        >
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden gap-px bg-slate-200 text-sm lg:grid lg:grid-cols-[0.8fr_1.4fr_1fr_1fr_0.8fr_0.8fr_0.9fr_1.4fr]">
              {['الصورة', 'الاسم', 'التخصص', 'العيادة', 'الحالة', 'التقييم', 'المواعيد', 'الإجراءات'].map(
                (header) => (
                  <div key={header} className="bg-slate-50 p-3 font-bold text-slate-700">
                    {header}
                  </div>
                ),
              )}
            </div>

            <div className="divide-y divide-slate-200">
              {doctors.map((doctor) => (
                <article
                  key={doctor.id}
                  className="grid gap-4 bg-white p-4 text-sm lg:grid-cols-[0.8fr_1.4fr_1fr_1fr_0.8fr_0.8fr_0.9fr_1.4fr] lg:items-center lg:gap-px lg:p-0"
                >
                  <div className="lg:p-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                      {doctor.avatar_url ? (
                        <img
                          src={doctor.avatar_url}
                          alt={doctor.full_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(doctor.full_name)
                      )}
                    </div>
                  </div>
                  <div className="font-bold text-slate-950 lg:p-3">
                    {doctor.full_name}
                  </div>
                  <div className="text-slate-700 lg:p-3">{doctor.specialty}</div>
                  <div className="text-slate-700 lg:p-3">
                    {doctor.clinic_name ?? 'غير متوفر'}
                  </div>
                  <div className="lg:p-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        doctor.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {doctor.active ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                  <div className="font-bold text-amber-600 lg:p-3">
                    {formatRating(doctor.averageRating)}
                  </div>
                  <div className="font-bold text-slate-950 lg:p-3">
                    {doctor.totalAppointments}
                  </div>
                  <div className="flex flex-col gap-2 lg:p-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleDoctorStatus(doctor)}
                      disabled={updatingDoctorId === doctor.id}
                      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        doctor.active
                          ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                          : 'bg-emerald-700 text-white hover:bg-emerald-800'
                      }`}
                    >
                      {updatingDoctorId === doctor.id
                        ? 'جاري التحديث...'
                        : doctor.active
                          ? '❌ تعطيل'
                          : '✅ تفعيل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDoctorProfile(doctor)}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      👁 عرض الملف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          title="المرضى"
          description="استعراض المرضى وعدد مواعيد كل مريض."
          icon="👥"
          open={openSections.patients}
          onToggle={() => toggleSection('patients')}
        >
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden gap-px bg-slate-200 text-sm md:grid md:grid-cols-[1.3fr_1.5fr_1fr_1fr_1fr]">
              {['الاسم', 'البريد', 'عدد المواعيد', 'تاريخ التسجيل', 'الإجراءات'].map(
                (header) => (
                  <div key={header} className="bg-slate-50 p-3 font-bold text-slate-700">
                    {header}
                  </div>
                ),
              )}
            </div>

            <div className="divide-y divide-slate-200">
              {patients.map((patient) => (
                <article
                  key={patient.id}
                  className="grid gap-3 bg-white p-4 text-sm md:grid-cols-[1.3fr_1.5fr_1fr_1fr_1fr] md:items-center md:gap-px md:p-0"
                >
                  <div className="font-bold text-slate-950 md:p-3">
                    {patient.full_name ?? 'غير متوفر'}
                  </div>
                  <div className="text-slate-700 md:p-3">{patient.email}</div>
                  <div className="font-bold text-slate-950 md:p-3">
                    {patient.totalAppointments}
                  </div>
                  <div className="text-slate-700 md:p-3">
                    {patient.created_at
                      ? dateFormatter.format(new Date(patient.created_at))
                      : 'غير متوفر'}
                  </div>
                  <div className="md:p-3">
                    <button
                      type="button"
                      onClick={() => setViewedPatient(patient)}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      👁 عرض الملف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {viewedPatient ? (
            <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    {viewedPatient.full_name ?? 'مريض'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    {viewedPatient.email ?? 'لا يوجد بريد'}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    عدد المواعيد: {viewedPatient.totalAppointments}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewedPatient(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          title="المواعيد"
          description="متابعة كل مواعيد المنصة حسب التاريخ والحالة."
          icon="📅"
          open={openSections.appointments}
          onToggle={() => toggleSection('appointments')}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {appointmentFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setAppointmentFilter(filter.value)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  appointmentFilter === filter.value
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="hidden gap-px bg-slate-200 text-sm md:grid md:grid-cols-4">
              {['المريض', 'الطبيب', 'التاريخ', 'الحالة'].map((header) => (
                <div key={header} className="bg-slate-50 p-3 font-bold text-slate-700">
                  {header}
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200">
              {appointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className="grid gap-3 bg-white p-4 text-sm md:grid-cols-4 md:items-center md:gap-px md:p-0"
                >
                  <div className="font-bold text-slate-950 md:p-3">
                    {appointment.patientName}
                  </div>
                  <div className="text-slate-700 md:p-3">
                    {appointment.doctor_name}
                  </div>
                  <div className="text-slate-700 md:p-3">
                    {dateFormatter.format(new Date(appointment.appointment_date))}
                  </div>
                  <div className="md:p-3">
                    <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                      {statusLabels[appointment.status] ?? appointment.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          title="التقييمات"
          description="مراجعة تقييمات المرضى وحذف غير المناسب منها."
          icon="⭐"
          open={openSections.reviews}
          onToggle={() => toggleSection('reviews')}
        >
          <div className="grid gap-3">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">
                      {review.patientName} ← {review.doctorName}
                    </p>
                    <p className="mt-1 text-sm font-bold text-amber-600">
                      {'★'.repeat(review.rating)}
                      <span className="text-slate-300">
                        {'★'.repeat(5 - review.rating)}
                      </span>
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {review.comment || 'لا يوجد تعليق'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {dateFormatter.format(new Date(review.created_at))}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDeleteReview(review.id)}
                    disabled={deletingReviewId === review.id}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    حذف التقييم
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          title="تحليلات المنصة"
          description="اتجاهات المواعيد والمستخدمين والتخصصات والتقييمات."
          icon="📈"
          open={openSections.analytics}
          onToggle={() => toggleSection('analytics')}
        >
          {analytics ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-950">
                  المواعيد حسب الشهر
                </h3>
                <div className="mt-4 grid gap-3">
                  {analytics.appointmentsByMonth.map((item) => {
                    const width = `${(item.count / maxAppointmentsByMonth) * 100}%`

                    return (
                      <div key={item.month} className="grid gap-2">
                        <div className="flex justify-between text-sm font-bold text-slate-700">
                          <span>
                            {monthFormatter.format(new Date(`${item.month}-01T00:00:00`))}
                          </span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-teal-600" style={{ width }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-950">
                  المستخدمون الجدد حسب الشهر
                </h3>
                <div className="mt-4 grid gap-3">
                  {analytics.newUsersByMonth.map((item) => {
                    const width = `${(item.count / maxUsersByMonth) * 100}%`

                    return (
                      <div key={item.month} className="grid gap-2">
                        <div className="flex justify-between text-sm font-bold text-slate-700">
                          <span>
                            {monthFormatter.format(new Date(`${item.month}-01T00:00:00`))}
                          </span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-950">
                  الأطباء حسب التخصص
                </h3>
                <div className="mt-4 grid gap-3">
                  {analytics.doctorsBySpecialty.map((item) => {
                    const width = `${(item.count / maxSpecialtyCount) * 100}%`

                    return (
                      <div key={item.specialty} className="grid gap-2">
                        <div className="flex justify-between text-sm font-bold text-slate-700">
                          <span>{item.specialty}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-sky-600" style={{ width }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-950">
                  توزيع التقييمات
                </h3>
                <div className="mt-4 grid gap-3">
                  {([5, 4, 3, 2, 1] as const).map((rating) => {
                    const count = analytics.ratingsDistribution[rating]
                    const width = `${(count / maxRatingCount) * 100}%`

                    return (
                      <div key={rating} className="grid gap-2">
                        <div className="flex justify-between text-sm font-bold text-slate-700">
                          <span className="text-amber-600">
                            {'★'.repeat(rating)}
                            <span className="text-slate-300">
                              {'★'.repeat(5 - rating)}
                            </span>
                          </span>
                          <span>{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-amber-400" style={{ width }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              لا توجد تحليلات متاحة حالياً
            </p>
          )}
        </SectionShell>
      </div>

      {selectedDoctorProfile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-profile-modal-title"
          onClick={() => setSelectedDoctorProfile(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-xl font-bold text-teal-800 ring-1 ring-teal-100">
                  {selectedDoctorProfile.avatar_url ? (
                    <img
                      src={selectedDoctorProfile.avatar_url}
                      alt={selectedDoctorProfile.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(selectedDoctorProfile.full_name)
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-teal-700">
                    ملف الطبيب
                  </p>
                  <h2
                    id="doctor-profile-modal-title"
                    className="mt-2 text-2xl font-bold tracking-normal text-slate-950"
                  >
                    {selectedDoctorProfile.full_name}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-teal-800">
                    {selectedDoctorProfile.specialty}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedDoctorProfile.clinic_name ?? 'عيادة غير محددة'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoctorProfile(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <dl className="mt-6 grid gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-bold text-slate-600">الحالة</dt>
                <dd className="mt-1 text-slate-950">
                  {selectedDoctorProfile.active ? 'نشط' : 'معطل'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">الهاتف</dt>
                <dd className="mt-1 text-slate-950">
                  {selectedDoctorProfile.phone ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">البريد الإلكتروني</dt>
                <dd className="mt-1 break-all text-slate-950">
                  {selectedDoctorProfile.email ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">سنوات الخبرة</dt>
                <dd className="mt-1 text-slate-950">
                  {selectedDoctorProfile.years_experience != null
                    ? `${selectedDoctorProfile.years_experience} سنة`
                    : 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">كلية الطب</dt>
                <dd className="mt-1 text-slate-950">
                  {selectedDoctorProfile.medical_school ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">سنة التخرج</dt>
                <dd className="mt-1 text-slate-950">
                  {selectedDoctorProfile.graduation_year ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">التقييم</dt>
                <dd className="mt-1 font-bold text-amber-600">
                  {formatRating(selectedDoctorProfile.averageRating)} (
                  {selectedDoctorProfile.reviewsCount} تقييم)
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">إجمالي المواعيد</dt>
                <dd className="mt-1 font-bold text-slate-950">
                  {selectedDoctorProfile.totalAppointments}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-600">اللغات</dt>
                <dd className="mt-1 text-slate-950">
                  {formatList(selectedDoctorProfile.languages)}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="font-bold text-slate-600">
                  المستشفيات السابقة
                </dt>
                <dd className="mt-1 text-slate-950">
                  {formatList(selectedDoctorProfile.previous_hospitals)}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="font-bold text-slate-600">نبذة مهنية</dt>
                <dd className="mt-1 leading-7 text-slate-700">
                  {selectedDoctorProfile.biography ?? 'غير متوفر'}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDoctorProfile(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
