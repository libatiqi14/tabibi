import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DoctorAvatar } from '../../components/doctor/DoctorAvatarSection'
import { useAuth } from '../../hooks/useAuth'
import type { Appointment } from '../../services/appointments'
import {
  getCurrentDoctor,
  getDoctorAppointments,
  updateAppointmentStatus,
  type AppointmentStatus,
  type DoctorProfile,
} from '../../services/doctor'
import { getDoctorStats, type DoctorStats } from '../../services/doctorStats'

type AppointmentTab = 'today' | 'upcoming' | 'confirmed' | 'completed' | 'cancelled' | 'all'

const appointmentDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const appointmentTimeFormatter = new Intl.DateTimeFormat('ar-MA', {
  hour: '2-digit',
  minute: '2-digit',
})

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'border border-amber-200 bg-amber-100 text-amber-700',
  confirmed: 'border border-green-200 bg-green-100 text-green-700',
  completed: 'border border-blue-200 bg-blue-100 text-blue-700',
  cancelled: 'border border-red-200 bg-red-100 text-red-700',
}

const tabLabels: Record<AppointmentTab, string> = {
  today: 'اليوم',
  upcoming: 'القادمة',
  confirmed: 'المؤكدة',
  completed: 'المكتملة',
  cancelled: 'الملغاة',
  all: 'الكل',
}

function getStatusLabel(status: string) {
  return statusLabels[status as AppointmentStatus] ?? status
}

function getStatusClass(status: string) {
  return (
    statusClasses[status as AppointmentStatus] ??
    'border border-slate-200 bg-slate-50 text-slate-700'
  )
}

function getPatientLabel(patientId: string) {
  return `مريض ${patientId.slice(0, 8)}`
}

function isSameDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  )
}

function isTodayAppointment(appointment: Appointment) {
  return isSameDay(new Date(appointment.appointment_date), new Date())
}

function sortByAppointmentDate(appointments: Appointment[]) {
  return [...appointments].sort(
    (firstAppointment, secondAppointment) =>
      new Date(firstAppointment.appointment_date).getTime() -
      new Date(secondAppointment.appointment_date).getTime(),
  )
}

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctorStats, setDoctorStats] = useState<DoctorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showDoctorSettingsMenu, setShowDoctorSettingsMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<AppointmentTab>('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const todayAppointments = useMemo(
    () => sortByAppointmentDate(appointments.filter(isTodayAppointment)),
    [appointments],
  )

  const nextAppointment = useMemo(() => {
    const now = new Date()

    return sortByAppointmentDate(
      appointments.filter(
        (appointment) =>
          ['scheduled', 'confirmed'].includes(appointment.status) &&
          new Date(appointment.appointment_date) >= now,
      ),
    )[0]
  }, [appointments])

  const todayAppointmentsCount = todayAppointments.length
  const scheduledAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'scheduled',
  ).length
  const confirmedAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'confirmed',
  ).length
  const completedAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'completed',
  ).length
  const cancelledAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'cancelled',
  ).length

  const filteredAppointments = useMemo(() => {
    const now = new Date()
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return sortByAppointmentDate(
      appointments.filter((appointment) => {
        const appointmentDate = new Date(appointment.appointment_date)
        const patientLabel = getPatientLabel(appointment.patient_id).toLowerCase()
        const notes = appointment.notes?.toLowerCase() ?? ''
        const matchesSearch =
          !normalizedSearch ||
          patientLabel.includes(normalizedSearch) ||
          appointment.patient_id.toLowerCase().includes(normalizedSearch) ||
          notes.includes(normalizedSearch)

        if (!matchesSearch) {
          return false
        }

        if (activeTab === 'today') {
          return isTodayAppointment(appointment)
        }

        if (activeTab === 'upcoming') {
          return (
            ['scheduled', 'confirmed'].includes(appointment.status) &&
            appointmentDate >= now
          )
        }

        if (activeTab === 'all') {
          return true
        }

        return appointment.status === activeTab
      }),
    )
  }, [activeTab, appointments, searchQuery])

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setIsLoading(true)
      setIsLoadingStats(true)
      setErrorMessage('')

      try {
        const doctorProfile = await getCurrentDoctor()
        const [doctorAppointments, stats] = await Promise.all([
          getDoctorAppointments(),
          getDoctorStats(doctorProfile.id),
        ])

        if (isMounted) {
          setDoctor(doctorProfile)
          setAppointments(doctorAppointments)
          setDoctorStats(stats)
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

  const settingsItems = [
    {
      icon: '👨‍⚕️',
      label: 'الملف المهني',
      path: '/doctor/settings/profile',
    },
    {
      icon: '🖼️',
      label: 'الصورة الشخصية',
      path: '/doctor/settings/avatar',
    },
    {
      icon: '🕒',
      label: 'ساعات العمل',
      path: '/doctor/settings/availability',
    },
    {
      icon: '📅',
      label: 'أيام العطل والإجازات',
      path: '/doctor/settings/unavailable-days',
    },
    {
      icon: '📊',
      label: 'الإحصائيات التفصيلية',
      path: '/doctor/settings/analytics',
    },
  ]

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/30 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-visible rounded-3xl bg-gradient-to-br from-teal-700 to-emerald-500 p-6 text-white shadow-xl sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              {doctor ? (
                <div className="rounded-3xl bg-white/15 p-2 ring-1 ring-white/20">
                  <DoctorAvatar doctor={doctor} />
                </div>
              ) : null}

              <div className="min-w-0">
                <p className="text-sm font-black text-teal-50">Tabibi</p>
                <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">
                  مرحباً دكتور {doctor?.full_name ?? ''}
                </h1>
                <p className="mt-3 text-sm font-semibold leading-8 text-teal-50 sm:text-base">
                  لديك {todayAppointmentsCount} مواعيد اليوم
                </p>

                <button
                  type="button"
                  onClick={() => setActiveTab('today')}
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-teal-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-teal-50"
                >
                  عرض مواعيد اليوم
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/25 bg-white/15 p-5 shadow-lg backdrop-blur">
                <p className="text-sm font-black text-teal-50">الموعد القادم</p>
                {nextAppointment ? (
                  <div className="mt-3">
                    <p className="text-2xl font-black">
                      {getPatientLabel(nextAppointment.patient_id)}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-teal-50">
                      على الساعة{' '}
                      {appointmentTimeFormatter.format(
                        new Date(nextAppointment.appointment_date),
                      )}
                    </p>
                    <span
                      className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${getStatusClass(
                        nextAppointment.status,
                      )}`}
                    >
                      {getStatusLabel(nextAppointment.status)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-semibold leading-8 text-teal-50">
                    لا يوجد موعد قادم حالياً.
                  </p>
                )}
              </div>

              <div className="relative mt-4 lg:absolute lg:left-0 lg:top-0 lg:mt-0">
                <button
                  type="button"
                  onClick={() =>
                    setShowDoctorSettingsMenu((currentValue) => !currentValue)
                  }
                  className={`inline-flex min-h-11 items-center justify-center rounded-2xl border px-5 text-sm font-black shadow-sm transition ${
                    showDoctorSettingsMenu
                      ? 'border-white bg-white text-teal-800'
                      : 'border-white/40 bg-white/10 text-white hover:bg-white/20'
                  }`}
                  aria-expanded={showDoctorSettingsMenu}
                >
                  ⚙️ إعدادات الطبيب
                </button>

                {showDoctorSettingsMenu ? (
                  <div className="absolute left-0 z-20 mt-3 w-72 rounded-2xl border border-slate-200 bg-white p-2 text-right shadow-xl">
                    {settingsItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-right text-sm font-bold text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              icon: '👥',
              label: 'إجمالي المرضى',
              value: doctorStats?.totalPatients ?? 0,
              className: 'text-teal-700',
            },
            {
              icon: '📅',
              label: 'إجمالي المواعيد',
              value: doctorStats?.totalAppointments ?? 0,
              className: 'text-slate-950',
            },
            {
              icon: '✅',
              label: 'المواعيد المكتملة',
              value: doctorStats?.completedAppointments ?? 0,
              className: 'text-emerald-700',
            },
            {
              icon: '⭐',
              label: 'متوسط التقييم',
              value:
                doctorStats?.averageRating != null
                  ? doctorStats.averageRating.toFixed(1)
                  : 'لا توجد',
              className: 'text-amber-600',
            },
            {
              icon: '💬',
              label: 'عدد التقييمات',
              value: doctorStats?.reviewsCount ?? 0,
              className: 'text-teal-700',
            },
          ].map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-bold text-slate-600">
                <span className="ml-2" aria-hidden="true">
                  {stat.icon}
                </span>
                {stat.label}
              </p>
              <p className={`mt-3 text-3xl font-black ${stat.className}`}>
                {isLoadingStats ? '...' : stat.value}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              icon: '🟡',
              label: 'مواعيد اليوم',
              value: todayAppointmentsCount,
              className: 'border-amber-200 bg-amber-50 text-amber-700',
            },
            {
              icon: '🟠',
              label: 'غير مؤكدة',
              value: scheduledAppointmentsCount,
              className: 'border-orange-200 bg-orange-50 text-orange-700',
            },
            {
              icon: '🟢',
              label: 'مؤكدة',
              value: confirmedAppointmentsCount,
              className: 'border-green-200 bg-green-50 text-green-700',
            },
            {
              icon: '🔵',
              label: 'مكتملة',
              value: completedAppointmentsCount,
              className: 'border-blue-200 bg-blue-50 text-blue-700',
            },
            {
              icon: '🔴',
              label: 'ملغاة',
              value: cancelledAppointmentsCount,
              className: 'border-red-200 bg-red-50 text-red-700',
            },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                if (stat.label === 'مواعيد اليوم') setActiveTab('today')
                if (stat.label === 'غير مؤكدة') setActiveTab('all')
                if (stat.label === 'مؤكدة') setActiveTab('confirmed')
                if (stat.label === 'مكتملة') setActiveTab('completed')
                if (stat.label === 'ملغاة') setActiveTab('cancelled')
              }}
              className={`rounded-2xl border p-5 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md ${stat.className}`}
            >
              <p className="text-3xl font-black">
                <span className="ml-2" aria-hidden="true">
                  {stat.icon}
                </span>
                {isLoading ? '...' : stat.value}
              </p>
              <p className="mt-3 text-sm font-bold text-slate-700">{stat.label}</p>
            </button>
          ))}
        </section>

        <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-4xl shadow-sm ring-1 ring-teal-100">
                📅
              </span>
              <div>
                <p className="text-sm font-black text-teal-700">منطقة العمل اليومية</p>
                <h2 className="mt-1 text-3xl font-black tracking-normal text-slate-950">
                  المواعيد
                </h2>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
                  لديك {todayAppointmentsCount} موعد اليوم، و {confirmedAppointmentsCount}{' '}
                  موعداً مؤكداً.
                </p>
              </div>
            </div>

            <div className="w-full lg:max-w-sm">
              <label className="sr-only" htmlFor="appointment-search">
                ابحث باسم المريض
              </label>
              <input
                id="appointment-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ابحث باسم المريض..."
                className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </div>
          </div>

          {nextAppointment ? (
            <article className="mt-6 rounded-3xl border-2 border-teal-200 bg-teal-50/70 p-5">
              <p className="text-sm font-black text-teal-700">الموعد القادم</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    {getPatientLabel(nextAppointment.patient_id)}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    {appointmentDateFormatter.format(
                      new Date(nextAppointment.appointment_date),
                    )}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${getStatusClass(
                    nextAppointment.status,
                  )}`}
                >
                  {getStatusLabel(nextAppointment.status)}
                </span>
              </div>
            </article>
          ) : null}

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {(Object.keys(tabLabels) as AppointmentTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                  activeTab === tab
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-600">
              جاري تحميل المواعيد...
            </p>
          ) : filteredAppointments.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {filteredAppointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-100 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-black text-slate-950">
                          {getPatientLabel(appointment.patient_id)}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getStatusClass(
                            appointment.status,
                          )}`}
                        >
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-bold text-teal-700">
                        {appointmentTimeFormatter.format(
                          new Date(appointment.appointment_date),
                        )}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {appointmentDateFormatter.format(
                          new Date(appointment.appointment_date),
                        )}
                      </p>

                      {appointment.notes ? (
                        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-7 text-slate-600">
                          {appointment.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                      {appointment.status === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateStatus(appointment.id, 'confirmed')
                          }
                          disabled={updatingId === appointment.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          إلغاء
                        </button>
                      ) : null}

                      {!['scheduled', 'confirmed'].includes(appointment.status) ? (
                        <span className="inline-flex min-h-10 items-center rounded-xl bg-slate-50 px-4 text-sm font-bold text-slate-500">
                          لا توجد إجراءات
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-600">
              لا توجد مواعيد مطابقة
            </p>
          )}
        </section>

        <div className="flex justify-center pt-2">
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
