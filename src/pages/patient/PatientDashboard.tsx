import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NotificationsPanel from '../../components/notifications/NotificationsPanel'
import { useAuth } from '../../hooks/useAuth'
import {
  getPatientAppointments,
  type Appointment,
} from '../../services/appointments'
import { getUnreadNotificationsCount } from '../../services/notifications'

const appointmentDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    scheduled: 'مجدول',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }

  return labels[status] ?? status
}

export default function PatientDashboard() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(true)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUpcomingAppointments, setShowUpcomingAppointments] = useState(false)
  const [showMedicalRecords, setShowMedicalRecords] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchAppointments = async () => {
      setIsFetchingAppointments(true)
      setErrorMessage('')

      try {
        const data = await getPatientAppointments()

        if (isMounted) {
          setAppointments(data)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل المواعيد. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsFetchingAppointments(false)
        }
      }
    }

    void fetchAppointments()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchUnreadNotificationsCount = async () => {
      try {
        const count = await getUnreadNotificationsCount()

        if (isMounted) {
          setUnreadNotificationsCount(count)
        }
      } catch (error) {
        console.error('Failed to load unread notifications count', error)
      }
    }

    void fetchUnreadNotificationsCount()

    return () => {
      isMounted = false
    }
  }, [])

  const upcomingAppointments = useMemo(() => {
    const now = new Date()

    return appointments
      .filter(
        (appointment) =>
          appointment.status === 'scheduled' &&
          new Date(appointment.appointment_date) > now,
      )
      .sort(
        (first, second) =>
          new Date(first.appointment_date).getTime() -
          new Date(second.appointment_date).getTime(),
      )
  }, [appointments])

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-teal-700">لوحة تحكم المريض</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
              مرحبا بك في نظام المواعيد الطبية
            </h1>
            <p className="mt-2 truncate text-sm text-slate-600">
              {authLoading
                ? 'جاري تحميل بيانات الحساب...'
                : user?.email ?? 'لا يوجد بريد إلكتروني'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate('/patient/book-appointment')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              حجز موعد جديد
            </button>

            <button
              type="button"
              onClick={() => navigate('/patient/appointments')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 px-5 text-sm font-bold text-teal-800 transition hover:bg-teal-100"
            >
              مواعيدي
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={authLoading}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              تسجيل الخروج
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              setShowUpcomingAppointments((currentValue) => !currentValue)
            }
            className={`rounded-lg border p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              showUpcomingAppointments
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-teal-200'
            }`}
            aria-expanded={showUpcomingAppointments}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  المواعيد القادمة
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  راجع مواعيدك القادمة وحالاتها.
                </span>
              </span>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showUpcomingAppointments ? '⌃' : '⌄'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
              {isFetchingAppointments
                ? 'جاري التحميل...'
                : `${upcomingAppointments.length} موعد`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowMedicalRecords((currentValue) => !currentValue)}
            className={`rounded-lg border p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              showMedicalRecords
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-teal-200'
            }`}
            aria-expanded={showMedicalRecords}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  السجلات الطبية
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  استعرض ملخصات الزيارات والوصفات والتقارير الطبية.
                </span>
              </span>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showMedicalRecords ? '⌃' : '⌄'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
              لا توجد سجلات جديدة
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotifications((currentValue) => !currentValue)}
            className={`rounded-lg border p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              showNotifications
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-teal-200'
            }`}
            aria-expanded={showNotifications}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  الإشعارات
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  تابع آخر تحديثات مواعيدك الطبية.
                </span>
              </span>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showNotifications ? '⌃' : '⌄'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
              {unreadNotificationsCount} غير مقروء
            </span>
          </button>
        </section>

        {showNotifications ? (
          <NotificationsPanel onUnreadCountChange={setUnreadNotificationsCount} />
        ) : null}

        {showMedicalRecords ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold tracking-normal text-slate-950">
                السجلات الطبية
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                استعرض ملخصات الزيارات والوصفات والتقارير الطبية.
              </p>
            </div>

            <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
              لا توجد سجلات طبية بعد
            </p>
          </section>
        ) : null}

        {showUpcomingAppointments ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-normal text-slate-950">
                المواعيد القادمة
              </h2>
              <p className="mt-2 text-sm text-slate-600">أقرب خمسة مواعيد مرتبة حسب التاريخ.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/patient/book-appointment')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              حجز موعد جديد
            </button>
          </div>

          {errorMessage ? (
            <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {isFetchingAppointments ? (
            <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
              جاري تحميل المواعيد...
            </p>
          ) : upcomingAppointments.length > 0 ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              <div className="hidden gap-px bg-slate-200 text-sm md:grid md:grid-cols-4">
                <div className="bg-slate-50 p-3 font-bold text-slate-700">الطبيب</div>
                <div className="bg-slate-50 p-3 font-bold text-slate-700">التخصص</div>
                <div className="bg-slate-50 p-3 font-bold text-slate-700">تاريخ الموعد</div>
                <div className="bg-slate-50 p-3 font-bold text-slate-700">الحالة</div>
              </div>
              <div className="divide-y divide-slate-200">
                {upcomingAppointments.map((appointment) => (
                  <article
                    key={appointment.id}
                    className="grid gap-3 bg-white p-4 text-sm md:grid-cols-4 md:gap-px md:p-0"
                  >
                    <div className="md:p-3">
                      <span className="block font-bold text-slate-500 md:hidden">الطبيب</span>
                      <span className="font-semibold text-slate-950">
                        {appointment.doctor_name}
                      </span>
                    </div>
                    <div className="md:p-3">
                      <span className="block font-bold text-slate-500 md:hidden">التخصص</span>
                      <span className="text-slate-700">{appointment.specialty}</span>
                    </div>
                    <div className="md:p-3">
                      <span className="block font-bold text-slate-500 md:hidden">
                        تاريخ الموعد
                      </span>
                      <span className="text-slate-700">
                        {appointmentDateFormatter.format(
                          new Date(appointment.appointment_date),
                        )}
                      </span>
                    </div>
                    <div className="md:p-3">
                      <span className="block font-bold text-slate-500 md:hidden">الحالة</span>
                      <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                        {getStatusLabel(appointment.status)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
              لا توجد مواعيد قادمة
            </p>
          )}
          </section>
        ) : null}
      </div>
    </main>
  )
}
