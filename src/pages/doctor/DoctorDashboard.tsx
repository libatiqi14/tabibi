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
import {
  formatLocalAppointmentDate,
  formatLocalAppointmentTime,
  isAppointmentToday,
} from '../../utils/dateTime'

type AppointmentTab = 'today' | 'upcoming' | 'confirmed' | 'completed' | 'cancelled' | 'all'

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'border border-amber-200 bg-amber-100 text-amber-700',
  confirmed: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
  completed: 'border border-blue-200 bg-blue-100 text-blue-700',
  cancelled: 'border border-rose-200 bg-rose-100 text-rose-700',
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

function getPatientName(appointment: Appointment) {
  return appointment.patient?.full_name?.trim() || 'مريض بدون اسم'
}

function getPatientSearchText(appointment: Appointment) {
  return [
    appointment.patient?.full_name,
    appointment.patient?.phone,
    appointment.patient?.email,
    appointment.patient ? null : appointment.patient_id,
    appointment.notes,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
}

function isTodayAppointment(appointment: Appointment) {
  return isAppointmentToday(appointment.appointment_date)
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
  const [showOverviewStats, setShowOverviewStats] = useState(false)
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
  const tabCounts: Record<AppointmentTab, number> = {
    today: todayAppointmentsCount,
    upcoming: appointments.filter(
      (appointment) =>
        ['scheduled', 'confirmed'].includes(appointment.status) &&
        new Date(appointment.appointment_date) >= new Date(),
    ).length,
    confirmed: confirmedAppointmentsCount,
    completed: completedAppointmentsCount,
    cancelled: cancelledAppointmentsCount,
    all: appointments.length,
  }

  const filteredAppointments = useMemo(() => {
    const now = new Date()
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return sortByAppointmentDate(
      appointments.filter((appointment) => {
        const appointmentDate = new Date(appointment.appointment_date)
        const patientSearchText = getPatientSearchText(appointment)
        const matchesSearch =
          !normalizedSearch || patientSearchText.includes(normalizedSearch)

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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="overflow-visible rounded-3xl bg-gradient-to-br from-teal-700 to-emerald-500 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
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

              </div>
            </div>

            <div className="relative lg:self-start">
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

        <section className="grid gap-3">
          <div>
            <p className="text-sm font-black text-teal-700">مؤشرات اليوم</p>
            <h2 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
              سير العمل اليومي
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                icon: '🟡',
                label: 'مواعيد اليوم',
                value: todayAppointmentsCount,
                className: 'border-amber-200 bg-amber-50 text-amber-700',
                onClick: () => setActiveTab('today'),
              },
              {
                icon: '🟠',
                label: 'غير مؤكدة',
                value: scheduledAppointmentsCount,
                className: 'border-orange-200 bg-orange-50 text-orange-700',
                onClick: () => setActiveTab('all'),
              },
              {
                icon: '🟢',
                label: 'مؤكدة',
                value: confirmedAppointmentsCount,
                className: 'border-green-200 bg-green-50 text-green-700',
                onClick: () => setActiveTab('confirmed'),
              },
              {
                icon: '🔵',
                label: 'الموعد القادم',
                value: nextAppointment
                  ? formatLocalAppointmentTime(nextAppointment.appointment_date)
                  : 'لا يوجد',
                className: 'border-blue-200 bg-blue-50 text-blue-700',
                onClick: () => setActiveTab('upcoming'),
              },
            ].map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={stat.onClick}
                className={`min-h-20 rounded-2xl border p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${stat.className}`}
              >
                <p className="text-2xl font-black leading-none">
                  <span className="ml-1 text-lg" aria-hidden="true">
                    {stat.icon}
                  </span>
                  {isLoading ? '...' : stat.value}
                </p>
                <p className="mt-2 text-sm font-bold leading-5 text-slate-700">
                  {stat.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowOverviewStats((currentValue) => !currentValue)}
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-teal-700"
              aria-expanded={showOverviewStats}
            >
              {showOverviewStats
                ? '\u0625\u062E\u0641\u0627\u0621 \u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629'
                : '\u0639\u0631\u0636 \u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629'}
            </button>
          </div>

          {showOverviewStats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
                icon: '🔴',
                label: 'المواعيد الملغاة',
                value: cancelledAppointmentsCount,
                className: 'text-red-700',
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
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-bold text-slate-500">
                  <span className="ml-1" aria-hidden="true">
                    {stat.icon}
                  </span>
                  {stat.label}
                </p>
                <p className={`mt-2 text-2xl font-black ${stat.className}`}>
                  {isLoadingStats ? '...' : stat.value}
                </p>
              </article>
            ))}
          </div>
          ) : null}
        </section>

        <section className="hidden gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

        <section className="hidden gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <div className="flex flex-col gap-4">
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

            <div className="grid gap-4 xl:grid-cols-[minmax(260px,360px)_1fr] xl:items-end">
              <div className="w-full">
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

              <div className="min-w-0">
                <p className="mb-2 text-sm font-black text-slate-700">تصفية المواعيد</p>
                <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex xl:justify-end">
                  <div className="inline-flex gap-1 rounded-2xl bg-slate-100 p-1.5 shadow-inner whitespace-nowrap">
                    {(Object.keys(tabLabels) as AppointmentTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
                          activeTab === tab
                            ? 'bg-teal-700 text-white shadow-md'
                            : 'text-slate-600 hover:bg-white hover:text-teal-700'
                        }`}
                      >
                        <span>{tabLabels[tab]}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            activeTab === tab
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-slate-500'
                          }`}
                        >
                          {tabCounts[tab]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-600">
              جاري تحميل المواعيد...
            </p>
          ) : filteredAppointments.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredAppointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className={`rounded-2xl border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-4 ${
                    nextAppointment?.id === appointment.id
                      ? 'border-2 border-teal-500'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex h-full flex-col gap-3">
                    <div className="min-w-0">
                      {nextAppointment?.id === appointment.id ? (
                        <span className="mb-2 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-black text-teal-700 ring-1 ring-teal-100">
                          الموعد القادم
                        </span>
                      ) : null}

                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 truncate text-base font-black text-slate-950">
                          <span className="ml-2" aria-hidden="true">
                            {'\uD83D\uDC64'}
                          </span>
                          {getPatientName(appointment)}
                        </h3>
                        <span
                          className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${getStatusClass(
                            appointment.status,
                          )}`}
                        >
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>

                      <p className="mt-3 text-2xl font-black leading-none text-teal-700">
                        <span className="ml-2" aria-hidden="true">
                          {'\u23F0'}
                        </span>
                        {formatLocalAppointmentTime(appointment.appointment_date)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        <span className="ml-2" aria-hidden="true">
                          {'\uD83D\uDCC5'}
                        </span>
                        {formatLocalAppointmentDate(appointment.appointment_date)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        {appointment.patient?.phone ? (
                          <p className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 font-semibold">
                            <span aria-hidden="true">{'\uD83D\uDCDE'}</span>
                            <span>{appointment.patient.phone}</span>
                          </p>
                        ) : null}

                      </div>

                      {appointment.notes ||
                      appointment.patient?.phone ||
                      appointment.patient?.email ? (
                        <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                          <summary className="cursor-pointer font-black text-teal-700">
                            {'\u0639\u0631\u0636 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644'}
                          </summary>
                          <div className="mt-2 grid gap-1.5 leading-6">
                            {appointment.patient?.phone ? (
                              <p>
                                <span className="font-black text-slate-700">
                                  {'\u0627\u0644\u0647\u0627\u062A\u0641'}:
                                </span>{' '}
                                {appointment.patient.phone}
                              </p>
                            ) : null}
                            {appointment.patient?.email ? (
                              <p className="break-all">
                                <span className="font-black text-slate-700">
                                  {'\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A'}:
                                </span>{' '}
                                {appointment.patient.email}
                              </p>
                            ) : null}
                            {appointment.notes ? (
                              <p>
                                <span className="font-black text-slate-700">
                                  {'\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A'}:
                                </span>{' '}
                                {appointment.notes}
                              </p>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {appointment.status === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateStatus(appointment.id, 'confirmed')
                          }
                          disabled={updatingId === appointment.id}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl bg-teal-700 px-3 text-xs font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="inline-flex min-h-9 items-center justify-center rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          إلغاء
                        </button>
                      ) : null}

                      {!['scheduled', 'confirmed'].includes(appointment.status) ? (
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                          {'\u062A\u0645\u062A \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0645\u0648\u0639\u062F'}
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
