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
  formatAppointmentDateInput,
  formatLocalAppointmentDate,
  formatLocalAppointmentTime,
  isAppointmentToday,
} from '../../utils/dateTime'

type AppointmentStatusFilter = AppointmentStatus | 'all'

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusFilterLabels: Record<AppointmentStatusFilter, string> = {
  all: 'الكل',
  scheduled: 'المجدولة',
  confirmed: 'المؤكدة',
  completed: 'المكتملة',
  cancelled: 'الملغاة',
}

function getStatusLabel(status: string) {
  return statusLabels[status as AppointmentStatus] ?? status
}

function getStatusClass(status: string) {
  return (
    statusClasses[status as AppointmentStatus] ??
    'bg-slate-100 text-slate-700'
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

function getDateFromInput(dateInput: string) {
  const [year, month, day] = dateInput.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function addDaysToDateInput(dateInput: string, days: number) {
  const date = getDateFromInput(dateInput)
  date.setDate(date.getDate() + days)

  return formatAppointmentDateInput(date)
}

function formatDisplayDate(dateInput: string) {
  const [year, month, day] = dateInput.split('-')

  return `${day}/${month}/${year}`
}

function formatDayTabDate(dateInput: string) {
  const date = getDateFromInput(dateInput)
  const weekday = new Intl.DateTimeFormat('ar-MA', { weekday: 'long' }).format(date)
  const [, month, day] = dateInput.split('-')

  return `${weekday} ${day}/${month}`
}

function getRelativeDayLabel(dateInput: string, index: number) {
  if (index === 0) {
    return 'اليوم'
  }

  if (index === 1) {
    return 'غداً'
  }

  if (index === 2) {
    return 'بعد غد'
  }

  return formatDayTabDate(dateInput)
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
  const [selectedDate, setSelectedDate] = useState(() => formatAppointmentDateInput())
  const [activeStatusFilter, setActiveStatusFilter] =
    useState<AppointmentStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const todayAppointments = useMemo(
    () => sortByAppointmentDate(appointments.filter(isTodayAppointment)),
    [appointments],
  )

  const todayAppointmentsCount = todayAppointments.length
  const selectedDayAppointments = useMemo(
    () =>
      sortByAppointmentDate(
        appointments.filter(
          (appointment) =>
            formatAppointmentDateInput(appointment.appointment_date) === selectedDate,
        ),
      ),
    [appointments, selectedDate],
  )
  const searchScopedDayAppointments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    if (!normalizedSearch) {
      return selectedDayAppointments
    }

    return selectedDayAppointments.filter((appointment) =>
      getPatientSearchText(appointment).includes(normalizedSearch),
    )
  }, [searchQuery, selectedDayAppointments])
  const scheduledAppointmentsCount = searchScopedDayAppointments.filter(
    (appointment) => appointment.status === 'scheduled',
  ).length
  const confirmedAppointmentsCount = searchScopedDayAppointments.filter(
    (appointment) => appointment.status === 'confirmed',
  ).length
  const cancelledAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'cancelled',
  ).length
  const selectedDayCompletedAppointmentsCount = searchScopedDayAppointments.filter(
    (appointment) => appointment.status === 'completed',
  ).length
  const selectedDayCancelledAppointmentsCount = searchScopedDayAppointments.filter(
    (appointment) => appointment.status === 'cancelled',
  ).length
  const statusFilterCounts: Record<AppointmentStatusFilter, number> = {
    all: searchScopedDayAppointments.length,
    scheduled: scheduledAppointmentsCount,
    confirmed: confirmedAppointmentsCount,
    completed: selectedDayCompletedAppointmentsCount,
    cancelled: selectedDayCancelledAppointmentsCount,
  }
  const visibleDayTabs = useMemo(() => {
    const today = formatAppointmentDateInput()

    return Array.from({ length: 5 }, (_, index) => {
      const date = addDaysToDateInput(today, index)

      return {
        date,
        label: getRelativeDayLabel(date, index),
      }
    })
  }, [])

  const filteredAppointments = useMemo(() => {
    return sortByAppointmentDate(
      searchScopedDayAppointments.filter((appointment) => {
        if (activeStatusFilter === 'all') {
          return true
        }

        return appointment.status === activeStatusFilter
      }),
    )
  }, [activeStatusFilter, searchScopedDayAppointments])

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
      icon: '⚙️',
      label: 'إعدادات الطبيب',
      path: '/doctor/settings/profile',
    },
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
      className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-4 text-slate-950 sm:px-6 sm:py-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="relative overflow-visible rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm sm:p-8">
          <div className="absolute left-4 top-4 z-30">
            <button
              type="button"
              onClick={() =>
                setShowDoctorSettingsMenu((currentValue) => !currentValue)
              }
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(15,118,110,0.08)] text-2xl font-black leading-none text-[#0f766e] shadow-sm transition hover:bg-[rgba(15,118,110,0.15)] focus:outline-none focus:ring-2 focus:ring-teal-100"
              aria-haspopup="menu"
              aria-expanded={showDoctorSettingsMenu}
              aria-label="القائمة الرئيسية"
            >
              ☰
            </button>

            <div
              className={`absolute left-0 mt-3 w-64 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 text-right shadow-xl transition-all duration-200 ${
                showDoctorSettingsMenu
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
              }`}
              role="menu"
            >
              {settingsItems.map((item) => (
                <button
                  key={item.path + item.label}
                  type="button"
                  onClick={() => {
                    setShowDoctorSettingsMenu(false)
                    navigate(item.path)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-right text-sm font-bold text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
                  role="menuitem"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setShowDoctorSettingsMenu(false)
                  void signOut()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-right text-sm font-bold text-red-600 transition hover:bg-red-50"
                role="menuitem"
              >
                <span aria-hidden="true">🚪</span>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-8 lg:flex-row lg:items-center lg:justify-between lg:pt-0">
            <div className="flex min-w-0 items-start gap-4 sm:items-center">
              {doctor ? (
                <div className="shrink-0 rounded-2xl bg-teal-50 p-1.5 ring-1 ring-teal-100 sm:rounded-3xl sm:p-2">
                  <div className="sm:hidden">
                    <DoctorAvatar doctor={doctor} size="md" />
                  </div>
                  <div className="hidden sm:block">
                    <DoctorAvatar doctor={doctor} />
                  </div>
                </div>
              ) : null}

              <div className="min-w-0">
                <p className="text-xs font-black text-teal-700 sm:text-sm">Tabibi</p>
                <h1 className="mt-1 truncate text-2xl font-black tracking-normal sm:mt-2 sm:text-4xl">
                  مرحباً دكتور {doctor?.full_name ?? ''}
                </h1>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-8">
                  لديك {todayAppointmentsCount} موعداً اليوم
                </p>
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold leading-7 text-red-600">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
            {successMessage}
          </p>
        ) : null}

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
                cardClass: 'bg-teal-50',
              },
              {
                icon: '📅',
                label: 'إجمالي المواعيد',
                value: doctorStats?.totalAppointments ?? 0,
                className: 'text-blue-700',
                cardClass: 'bg-blue-50',
              },
              {
                icon: '✅',
                label: 'المواعيد المكتملة',
                value: doctorStats?.completedAppointments ?? 0,
                className: 'text-green-700',
                cardClass: 'bg-green-50',
              },
              {
                icon: '🔴',
                label: 'المواعيد الملغاة',
                value: cancelledAppointmentsCount,
                className: 'text-red-700',
                cardClass: 'bg-red-50',
              },
              {
                icon: '⭐',
                label: 'متوسط التقييم',
                value:
                  doctorStats?.averageRating != null
                    ? doctorStats.averageRating.toFixed(1)
                    : 'لا توجد',
                className: 'text-amber-600',
                cardClass: 'bg-amber-50',
              },
              {
                icon: '💬',
                label: 'عدد التقييمات',
                value: doctorStats?.reviewsCount ?? 0,
                className: 'text-teal-700',
                cardClass: 'bg-teal-50',
              },
            ].map((stat) => (
              <article
                key={stat.label}
                className={`rounded-2xl border border-slate-200 p-4 shadow-sm ${stat.cardClass}`}
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

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl shadow-sm ring-1 ring-teal-100">
                📅
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-black tracking-normal text-slate-950">
                  مواعيد يوم {formatDisplayDate(selectedDate)}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                  لديك {selectedDayAppointments.length} موعداً في هذا اليوم، و {confirmedAppointmentsCount}{' '}
                  موعداً مؤكداً.
                </p>
              </div>
            </div>

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
                className="min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="mb-3 grid gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="mb-2 text-sm font-black text-slate-700">اختر اليوم</p>
                <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="inline-flex min-w-full gap-2 whitespace-nowrap lg:min-w-0">
                    {visibleDayTabs.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border px-4 text-sm font-black transition ${
                          selectedDate === day.date
                            ? 'border-teal-600 bg-teal-600 text-white shadow-md'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate((currentDate) => addDaysToDateInput(currentDate, -1))
                  }
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 hover:text-teal-700"
                >
                  السابق
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    if (event.target.value) {
                      setSelectedDate(event.target.value)
                    }
                  }}
                  className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                  aria-label="اختر اليوم"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate((currentDate) => addDaysToDateInput(currentDate, 1))
                  }
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 hover:text-teal-700"
                >
                  التالي
                </button>
              </div>
            </div>

            <p className="text-sm font-black text-slate-700">تصفية الحالة</p>
            <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-full gap-1 rounded-2xl bg-slate-100 p-1 shadow-inner whitespace-nowrap lg:min-w-0">
                {(Object.keys(statusFilterLabels) as AppointmentStatusFilter[]).map(
                  (statusFilter) => (
                    <button
                      key={statusFilter}
                      type="button"
                      onClick={() => setActiveStatusFilter(statusFilter)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition sm:px-4 ${
                          activeStatusFilter === statusFilter
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-white hover:text-teal-700'
                        }`}
                    >
                      <span>{statusFilterLabels[statusFilter]}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          activeStatusFilter === statusFilter
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-slate-500'
                        }`}
                      >
                        {statusFilterCounts[statusFilter]}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              جاري تحميل المواعيد...
            </p>
          ) : filteredAppointments.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredAppointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className="min-h-[180px] max-h-[220px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex h-full flex-col gap-2">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 truncate text-sm font-black text-slate-950">
                          <span className="ml-1" aria-hidden="true">
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

                      <p className="mt-2 text-2xl font-black leading-none text-teal-700">
                        <span className="ml-1" aria-hidden="true">
                          {'\u23F0'}
                        </span>
                        {formatLocalAppointmentTime(appointment.appointment_date)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        <span className="ml-1" aria-hidden="true">
                          {'\uD83D\uDCC5'}
                        </span>
                        {formatLocalAppointmentDate(appointment.appointment_date)}
                      </p>

                      {appointment.notes ||
                      appointment.patient?.phone ||
                      appointment.patient?.email ? (
                        <details className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                          <summary className="cursor-pointer font-black text-teal-700">
                            {'\u0639\u0631\u0636 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644'}
                          </summary>
                          <div className="mt-1.5 grid gap-1 leading-5">
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

                    <div className="mt-auto flex flex-wrap gap-1.5 pt-0.5">
                      {appointment.status === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateStatus(appointment.id, 'confirmed')
                          }
                          disabled={updatingId === appointment.id}
                        className="inline-flex min-h-8 items-center justify-center rounded-xl bg-teal-600 px-2.5 text-xs font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="inline-flex min-h-8 items-center justify-center rounded-xl bg-teal-600 px-2.5 text-xs font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="inline-flex min-h-8 items-center justify-center rounded-xl border border-red-300 bg-white px-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          إلغاء
                        </button>
                      ) : null}

                      {!['scheduled', 'confirmed'].includes(appointment.status) ? (
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
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
              {selectedDayAppointments.length === 0
                ? 'لا توجد مواعيد في هذا اليوم'
                : 'لا توجد مواعيد مطابقة'}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
