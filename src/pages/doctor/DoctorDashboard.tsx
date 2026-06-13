import { useEffect, useState } from 'react'
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
import {
  getDoctorStats,
  type DoctorStats,
} from '../../services/doctorStats'

const appointmentDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
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

function isTodayAppointment(appointment: Appointment) {
  const appointmentDate = new Date(appointment.appointment_date)
  const today = new Date()

  return (
    appointmentDate.getFullYear() === today.getFullYear() &&
    appointmentDate.getMonth() === today.getMonth() &&
    appointmentDate.getDate() === today.getDate()
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
  const [showAppointments, setShowAppointments] = useState(false)
  const [showDoctorSettingsMenu, setShowDoctorSettingsMenu] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const todayAppointmentsCount = appointments.filter(isTodayAppointment).length
  const confirmedAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'confirmed',
  ).length
  const completedAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'completed',
  ).length
  const cancelledAppointmentsCount = appointments.filter(
    (appointment) => appointment.status === 'cancelled',
  ).length

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

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowDoctorSettingsMenu((currentValue) => !currentValue)
              }
              className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-bold transition ${
                showDoctorSettingsMenu
                  ? 'border-teal-600 bg-teal-50 text-teal-800'
                  : 'border-teal-200 bg-white text-teal-800 hover:bg-teal-50'
              }`}
              aria-expanded={showDoctorSettingsMenu}
            >
              ⚙️ إعدادات الطبيب
            </button>

            {showDoctorSettingsMenu ? (
              <div className="absolute left-0 z-20 mt-3 w-72 rounded-xl border border-slate-200 bg-white p-2 text-right shadow-sm">
                {[
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
                ].map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-right text-sm font-bold text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: '🟡',
              label: 'مواعيد اليوم',
              value: todayAppointmentsCount,
              className: 'border-amber-200 bg-amber-50 text-amber-700',
            },
            {
              icon: '🟢',
              label: 'المواعيد المؤكدة',
              value: confirmedAppointmentsCount,
              className: 'border-green-200 bg-green-50 text-green-700',
            },
            {
              icon: '🔵',
              label: 'المواعيد المكتملة',
              value: completedAppointmentsCount,
              className: 'border-blue-200 bg-blue-50 text-blue-700',
            },
            {
              icon: '🔴',
              label: 'المواعيد الملغاة',
              value: cancelledAppointmentsCount,
              className: 'border-red-200 bg-red-50 text-red-700',
            },
          ].map((stat) => (
            <article
              key={stat.label}
              className={`rounded-2xl border p-5 shadow-sm ${stat.className}`}
            >
              <p className="text-3xl font-black">
                <span className="ml-2" aria-hidden="true">
                  {stat.icon}
                </span>
                {isLoading ? '...' : stat.value}
              </p>
              <p className="mt-3 text-sm font-bold text-slate-700">{stat.label}</p>
            </article>
          ))}
        </section>

        <section className="order-1 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-7 shadow-sm">
          <button
            type="button"
            onClick={() => setShowAppointments((currentValue) => !currentValue)}
            className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
            aria-expanded={showAppointments}
          >
            <span className="flex items-start gap-4">
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm ring-1 ring-teal-100"
                aria-hidden="true"
              >
                📅
              </span>
              <span>
                <span className="block text-3xl font-black tracking-normal text-slate-950">
                  المواعيد
                </span>
                <span className="mt-2 block text-sm leading-7 text-slate-600">
                  راجع مواعيد المرضى وقم بتأكيدها أو إكمالها أو إلغائها.
                </span>
                <span className="mt-2 block text-sm font-bold leading-7 text-teal-800">
                  لديك {todayAppointmentsCount} موعد اليوم، و{' '}
                  {confirmedAppointmentsCount} موعدًا مؤكدًا.
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
              لديك {todayAppointmentsCount} موعد اليوم، و{' '}
              {confirmedAppointmentsCount} موعدًا مؤكدًا.
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
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
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
