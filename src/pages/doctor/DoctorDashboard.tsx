import { useEffect, useState } from 'react'
import DoctorAvailabilitySection from '../../components/doctor/DoctorAvailabilitySection'
import DoctorAvatarSection, {
  DoctorAvatar,
} from '../../components/doctor/DoctorAvatarSection'
import DoctorProfessionalProfileSection from '../../components/doctor/DoctorProfessionalProfileSection'
import { useAuth } from '../../hooks/useAuth'
import type { Appointment } from '../../services/appointments'
import {
  getCurrentDoctor,
  getDoctorAppointments,
  updateAppointmentStatus,
  type AppointmentStatus,
  type DoctorProfile,
} from '../../services/doctor'
import {
  getDoctorAnalytics,
  type DoctorAnalytics,
} from '../../services/doctorAnalytics'
import {
  getDoctorStats,
  type DoctorStats,
} from '../../services/doctorStats'

const appointmentDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const monthFormatter = new Intl.DateTimeFormat('ar-MA', {
  month: 'short',
  year: 'numeric',
})

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  confirmed: 'bg-teal-50 text-teal-800 ring-teal-600/20',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-600/20',
}

function getStatusLabel(status: string) {
  return statusLabels[status as AppointmentStatus] ?? status
}

function getStatusClass(status: string) {
  return (
    statusClasses[status as AppointmentStatus] ??
    'bg-slate-50 text-slate-700 ring-slate-600/20'
  )
}

function getPatientLabel(patientId: string) {
  return `مريض ${patientId.slice(0, 8)}`
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`
}

export default function DoctorDashboard() {
  const { signOut } = useAuth()
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctorStats, setDoctorStats] = useState<DoctorStats | null>(null)
  const [doctorAnalytics, setDoctorAnalytics] =
    useState<DoctorAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showAvatarSettings, setShowAvatarSettings] = useState(false)
  const [showProfessionalProfile, setShowProfessionalProfile] = useState(false)
  const [showAvailabilitySettings, setShowAvailabilitySettings] = useState(false)
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false)
  const [showAppointments, setShowAppointments] = useState(false)
  const [showDoctorSettings, setShowDoctorSettings] = useState(false)
  const [analyticsErrorMessage, setAnalyticsErrorMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setIsLoading(true)
      setIsLoadingStats(true)
      setIsLoadingAnalytics(true)
      setErrorMessage('')
      setAnalyticsErrorMessage('')

      try {
        const doctorProfile = await getCurrentDoctor()
        const [doctorAppointments, stats, analyticsResult] = await Promise.all([
          getDoctorAppointments(),
          getDoctorStats(doctorProfile.id),
          getDoctorAnalytics(doctorProfile.id)
            .then((analytics) => ({ analytics, error: null }))
            .catch((error: unknown) => ({ analytics: null, error })),
        ])

        if (isMounted) {
          setDoctor(doctorProfile)
          setAppointments(doctorAppointments)
          setDoctorStats(stats)

          if (analyticsResult.analytics) {
            setDoctorAnalytics(analyticsResult.analytics)
          }

          if (analyticsResult.error) {
            const message =
              analyticsResult.error instanceof Error
                ? analyticsResult.error.message
                : 'تعذر تحميل الإحصائيات التفصيلية. يرجى المحاولة مرة أخرى.'
            setAnalyticsErrorMessage(message)
          }
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل لوحة التحكم. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
          setIsLoadingStats(false)
          setIsLoadingAnalytics(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const handleUpdateStatus = async (
    appointmentId: string,
    status: AppointmentStatus,
  ) => {
    setUpdatingId(appointmentId)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedAppointment = await updateAppointmentStatus(appointmentId, status)

      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === updatedAppointment.id ? updatedAppointment : appointment,
        ),
      )
      setSuccessMessage('تم تحديث حالة الموعد بنجاح.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحديث حالة الموعد. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setUpdatingId(null)
    }
  }

  const maxMonthlyAppointments = Math.max(
    1,
    ...(doctorAnalytics?.monthlyAppointments.map((month) => month.count) ?? [0]),
  )
  const maxRatingCount = Math.max(
    1,
    ...([1, 2, 3, 4, 5] as const).map(
      (rating) => doctorAnalytics?.ratingDistribution[rating] ?? 0,
    ),
  )

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            {doctor ? <DoctorAvatar doctor={doctor} /> : null}

            <div className="min-w-0">
              <p className="text-sm font-bold text-teal-700">Tabibi</p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                لوحة الطبيب
              </h1>
              <p className="mt-2 text-base font-bold text-slate-800">
                {isLoading ? 'جاري تحميل بيانات الطبيب...' : doctor?.full_name ?? 'الطبيب'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {doctor?.specialty ?? 'التخصص غير متوفر'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDoctorSettings((currentValue) => !currentValue)}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-bold transition ${
              showDoctorSettings
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-teal-200 bg-white text-teal-800 hover:bg-teal-50'
            }`}
            aria-expanded={showDoctorSettings}
          >
            ⚙️ إعدادات الطبيب
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

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">👥 إجمالي المرضى</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {isLoadingStats ? '...' : doctorStats?.totalPatients ?? 0}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">📅 إجمالي المواعيد</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {isLoadingStats ? '...' : doctorStats?.totalAppointments ?? 0}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">✅ المواعيد المكتملة</p>
            <p className="mt-3 text-3xl font-bold text-emerald-700">
              {isLoadingStats ? '...' : doctorStats?.completedAppointments ?? 0}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">⭐ متوسط التقييم</p>
            <p className="mt-3 text-3xl font-bold text-amber-600">
              {isLoadingStats
                ? '...'
                : doctorStats?.averageRating != null
                  ? doctorStats.averageRating.toFixed(1)
                  : 'لا توجد'}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">💬 عدد التقييمات</p>
            <p className="mt-3 text-3xl font-bold text-teal-700">
              {isLoadingStats ? '...' : doctorStats?.reviewsCount ?? 0}
            </p>
          </article>
        </section>

        <section className="order-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {showDoctorSettings ? (
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
                    aria-hidden="true"
                  >
                    ⚙️
                  </span>
                  <div>
                    <h2 className="text-xl font-bold tracking-normal text-slate-950">
                      إعدادات الطبيب
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      أدر ملفك المهني وصورتك وساعات العمل والإحصائيات من مكان واحد.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDoctorSettings(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  إخفاء الإعدادات
                </button>
              </div>
        <section className="order-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() =>
              setShowDetailedAnalytics((currentValue) => !currentValue)
            }
            className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
            aria-expanded={showDetailedAnalytics}
          >
            <span className="flex items-start gap-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
                aria-hidden="true"
              >
                📊
              </span>
              <span>
                <span className="block text-xl font-bold tracking-normal text-slate-950">
                  الإحصائيات التفصيلية
                </span>
                <span className="mt-2 block text-sm leading-7 text-slate-600">
                  تابع أداء العيادة والمواعيد والتقييمات بشكل مفصل.
                </span>
              </span>
            </span>

            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
              {showDetailedAnalytics ? '⌃' : '⌄'}
            </span>
          </button>

          {showDetailedAnalytics ? (
            <div className="mt-5 grid gap-5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDetailedAnalytics(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  إخفاء الإحصائيات التفصيلية
                </button>
              </div>

              {analyticsErrorMessage ? (
                <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                  {analyticsErrorMessage}
                </p>
              ) : null}

              {isLoadingAnalytics ? (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
                  جاري تحميل الإحصائيات التفصيلية...
                </p>
              ) : doctorAnalytics ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        مواعيد اليوم
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {doctorAnalytics.todayAppointments}
                      </p>
                    </article>

                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        مواعيد هذا الأسبوع
                      </p>
                      <p className="mt-2 text-2xl font-bold text-teal-700">
                        {doctorAnalytics.weekAppointments}
                      </p>
                    </article>

                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        مواعيد هذا الشهر
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {doctorAnalytics.monthAppointments}
                      </p>
                    </article>

                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        مرضى جدد هذا الشهر
                      </p>
                      <p className="mt-2 text-2xl font-bold text-emerald-700">
                        {doctorAnalytics.newPatientsThisMonth}
                      </p>
                    </article>

                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        معدل الإلغاء
                      </p>
                      <p className="mt-2 text-2xl font-bold text-rose-700">
                        {formatPercentage(doctorAnalytics.cancelledRate)}
                      </p>
                    </article>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg font-bold text-slate-950">
                          المواعيد حسب الحالة
                        </h3>
                        <span className="text-sm font-semibold text-emerald-700">
                          معدل الإكمال {formatPercentage(doctorAnalytics.completedRate)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {(['scheduled', 'confirmed', 'completed', 'cancelled'] as const).map(
                          (status) => (
                            <div
                              key={status}
                              className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                            >
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${getStatusClass(
                                  status,
                                )}`}
                              >
                                {getStatusLabel(status)}
                              </span>
                              <span className="text-lg font-bold text-slate-950">
                                {doctorAnalytics.byStatus[status]}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 p-4">
                      <h3 className="text-lg font-bold text-slate-950">
                        توزيع التقييمات
                      </h3>

                      <div className="mt-4 grid gap-3">
                        {([5, 4, 3, 2, 1] as const).map((rating) => {
                          const count = doctorAnalytics.ratingDistribution[rating]
                          const width = `${(count / maxRatingCount) * 100}%`

                          return (
                            <div key={rating} className="grid gap-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-bold text-amber-600">
                                  {'★'.repeat(rating)}
                                  <span className="text-slate-300">
                                    {'★'.repeat(5 - rating)}
                                  </span>
                                </span>
                                <span className="font-bold text-slate-700">
                                  {count}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-amber-400"
                                  style={{ width }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  </div>

                  <section className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-lg font-bold text-slate-950">
                      المواعيد الشهرية خلال آخر 6 أشهر
                    </h3>

                    <div className="mt-4 grid gap-3">
                      {doctorAnalytics.monthlyAppointments.map((month) => {
                        const monthDate = new Date(`${month.month}-01T00:00:00`)
                        const width = `${(month.count / maxMonthlyAppointments) * 100}%`

                        return (
                          <div
                            key={month.month}
                            className="grid gap-2 sm:grid-cols-[8rem_1fr_3rem] sm:items-center"
                          >
                            <span className="text-sm font-bold text-slate-700">
                              {monthFormatter.format(monthDate)}
                            </span>
                            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-teal-600"
                                style={{ width }}
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-950">
                              {month.count}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              ) : (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
                  لا توجد إحصائيات متاحة حالياً
                </p>
              )}
            </div>
          ) : null}
        </section>

        {doctor ? (
          <section className="order-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowAvatarSettings((currentValue) => !currentValue)
              }
              className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
              aria-expanded={showAvatarSettings}
            >
              <span className="flex items-start gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
                  aria-hidden="true"
                >
                  🖼️
                </span>
                <span>
                  <span className="block text-xl font-bold tracking-normal text-slate-950">
                    الصورة الشخصية للطبيب
                  </span>
                  <span className="mt-2 block text-sm leading-7 text-slate-600">
                    ارفع صورة شخصية تظهر للمرضى عند اختيار الطبيب.
                  </span>
                </span>
              </span>

              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
                {showAvatarSettings ? '⌃' : '⌄'}
              </span>
            </button>

            {showAvatarSettings ? (
              <div className="mt-5 grid gap-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAvatarSettings(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    إخفاء الصورة الشخصية
                  </button>
                </div>

                <DoctorAvatarSection doctor={doctor} onDoctorChange={setDoctor} />
              </div>
            ) : null}
          </section>
        ) : null}

        {doctor ? (
          <section className="order-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowProfessionalProfile((currentValue) => !currentValue)
              }
              className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
              aria-expanded={showProfessionalProfile}
            >
              <span className="flex items-start gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
                  aria-hidden="true"
                >
                  👨‍⚕️
                </span>
                <span>
                  <span className="block text-xl font-bold tracking-normal text-slate-950">
                    الملف المهني
                  </span>
                  <span className="mt-2 block text-sm leading-7 text-slate-600">
                    أضف معلوماتك المهنية ليراها المرضى عند اختيار الطبيب.
                  </span>
                </span>
              </span>

              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
                {showProfessionalProfile ? '⌃' : '⌄'}
              </span>
            </button>

            {showProfessionalProfile ? (
              <div className="mt-5 grid gap-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowProfessionalProfile(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    إخفاء الملف المهني
                  </button>
                </div>

                <DoctorProfessionalProfileSection
                  doctor={doctor}
                  onDoctorChange={setDoctor}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {doctor ? (
          <section className="order-1 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() =>
                setShowAvailabilitySettings((currentValue) => !currentValue)
              }
              className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
              aria-expanded={showAvailabilitySettings}
            >
              <span className="flex items-start gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
                  aria-hidden="true"
                >
                  🕒
                </span>
                <span>
                  <span className="block text-xl font-bold tracking-normal text-slate-950">
                    تحديد أوقات العمل
                  </span>
                  <span className="mt-2 block text-sm leading-7 text-slate-600">
                    اضبط الأيام والساعات التي يمكن للمرضى حجز المواعيد فيها.
                  </span>
                </span>
              </span>

              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
                {showAvailabilitySettings ? '⌃' : '⌄'}
              </span>
            </button>

            {showAvailabilitySettings ? (
              <div className="mt-5 grid gap-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAvailabilitySettings(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    إخفاء أوقات العمل
                  </button>
                </div>

                <DoctorAvailabilitySection doctorId={doctor.id} />
              </div>
            ) : null}
          </section>
        ) : null}

            </div>
          ) : null}
        </section>

        <section className="order-1 rounded-lg border border-teal-200 bg-teal-50/50 p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowAppointments((currentValue) => !currentValue)}
            className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
            aria-expanded={showAppointments}
          >
            <span className="flex items-start gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm ring-1 ring-teal-100"
                aria-hidden="true"
              >
                📅
              </span>
              <span>
                <span className="block text-2xl font-black tracking-normal text-slate-950">
                  المواعيد
                </span>
                <span className="mt-2 block text-sm leading-7 text-slate-600">
                  راجع مواعيد المرضى وقم بتأكيدها أو إكمالها أو إلغائها.
                </span>
              </span>
            </span>

            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
              {showAppointments ? '⌃' : '⌄'}
            </span>
          </button>

          {showAppointments ? (
            <div className="mt-5 grid gap-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAppointments(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  إخفاء المواعيد
                </button>
              </div>

              <div>
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-normal text-slate-950">المواعيد</h2>
            <p className="mt-2 text-sm text-slate-600">
              راجع المواعيد وقم بتأكيدها أو إكمالها أو إلغائها.
            </p>
          </div>

          {isLoading ? (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              جاري تحميل المواعيد...
            </p>
          ) : appointments.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="hidden gap-px bg-slate-200 text-sm lg:grid lg:grid-cols-[1.2fr_1.2fr_1fr_1.8fr]">
                <div className="bg-slate-50 p-3 font-bold text-slate-700">المريض</div>
                <div className="bg-slate-50 p-3 font-bold text-slate-700">التاريخ</div>
                <div className="bg-slate-50 p-3 font-bold text-slate-700">الحالة</div>
                <div className="bg-slate-50 p-3 font-bold text-slate-700">الإجراءات</div>
              </div>

              <div className="divide-y divide-slate-200">
                {appointments.map((appointment) => (
                  <article
                    key={appointment.id}
                    className="grid gap-4 bg-white p-4 text-sm lg:grid-cols-[1.2fr_1.2fr_1fr_1.8fr] lg:items-center lg:gap-px lg:p-0"
                  >
                    <div className="lg:p-3">
                      <span className="block font-bold text-slate-500 lg:hidden">المريض</span>
                      <span className="font-semibold text-slate-950">
                        {getPatientLabel(appointment.patient_id)}
                      </span>
                    </div>

                    <div className="lg:p-3">
                      <span className="block font-bold text-slate-500 lg:hidden">التاريخ</span>
                      <span className="text-slate-700">
                        {appointmentDateFormatter.format(
                          new Date(appointment.appointment_date),
                        )}
                      </span>
                    </div>

                    <div className="lg:p-3">
                      <span className="block font-bold text-slate-500 lg:hidden">الحالة</span>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${getStatusClass(
                          appointment.status,
                        )}`}
                      >
                        {getStatusLabel(appointment.status)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 lg:flex-row lg:p-3">
                      {appointment.status === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateStatus(appointment.id, 'confirmed')
                          }
                          disabled={updatingId === appointment.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          تأكيد
                        </button>
                      ) : null}

                      {appointment.status === 'confirmed' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateStatus(appointment.id, 'completed')
                          }
                          disabled={updatingId === appointment.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          إكمال
                        </button>
                      ) : null}

                      {['scheduled', 'confirmed'].includes(appointment.status) ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateStatus(appointment.id, 'cancelled')
                          }
                          disabled={updatingId === appointment.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          إلغاء
                        </button>
                      ) : null}

                      {!['scheduled', 'confirmed'].includes(appointment.status) ? (
                        <span className="text-sm text-slate-500">لا توجد إجراءات</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              لا توجد مواعيد
            </p>
          )}
              </div>
            </div>
          ) : null}
        </section>

        <div className="order-2 flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-5 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    </main>
  )
}
