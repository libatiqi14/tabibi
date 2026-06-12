import { useEffect, useMemo, useState } from 'react'
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

export default function DoctorDashboard() {
  const { signOut } = useAuth()
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showAvatarSettings, setShowAvatarSettings] = useState(false)
  const [showProfessionalProfile, setShowProfessionalProfile] = useState(false)
  const [showAvailabilitySettings, setShowAvailabilitySettings] = useState(false)
  const [showAppointments, setShowAppointments] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const [doctorProfile, doctorAppointments] = await Promise.all([
          getCurrentDoctor(),
          getDoctorAppointments(),
        ])

        if (isMounted) {
          setDoctor(doctorProfile)
          setAppointments(doctorAppointments)
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
        }
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const statistics = useMemo(() => {
    const now = Date.now()
    const upcomingAppointments = appointments.filter(
      (appointment) =>
        ['scheduled', 'confirmed'].includes(appointment.status) &&
        new Date(appointment.appointment_date).getTime() > now,
    )
    const completedAppointments = appointments.filter(
      (appointment) => appointment.status === 'completed',
    )

    return {
      total: appointments.length,
      upcoming: upcomingAppointments.length,
      completed: completedAppointments.length,
    }
  }, [appointments])

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            {doctor ? <DoctorAvatar doctor={doctor} /> : null}

            <div className="min-w-0">
              <p className="text-sm font-semibold text-teal-700">لوحة تحكم الطبيب</p>
              <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
                {isLoading ? 'جاري تحميل بيانات الطبيب...' : doctor?.full_name ?? 'الطبيب'}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {doctor?.specialty ?? 'التخصص غير متوفر'}
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

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">إجمالي المواعيد</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {isLoading ? '...' : statistics.total}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">المواعيد القادمة</p>
            <p className="mt-3 text-3xl font-bold text-teal-700">
              {isLoading ? '...' : statistics.upcoming}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">المواعيد المكتملة</p>
            <p className="mt-3 text-3xl font-bold text-emerald-700">
              {isLoading ? '...' : statistics.completed}
            </p>
          </article>
        </section>

        {doctor ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setShowAppointments((currentValue) => !currentValue)}
            className="flex w-full flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-between"
            aria-expanded={showAppointments}
          >
            <span className="flex items-start gap-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
                aria-hidden="true"
              >
                📅
              </span>
              <span>
                <span className="block text-xl font-bold tracking-normal text-slate-950">
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
      </div>
    </main>
  )
}
