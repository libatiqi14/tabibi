import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  cancelAppointment,
  getPatientAppointments,
  rescheduleAppointment,
  type Appointment,
} from '../../services/appointments'
import {
  createDoctorReview,
  getPatientReviewForAppointment,
} from '../../services/reviews'
import {
  buildAppointmentDateTime,
  formatAppointmentDateTimeLocalInput,
  formatLocalAppointmentDate,
  formatLocalAppointmentTime,
} from '../../utils/dateTime'

const statusLabels: Record<string, string> = {
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const statusClasses: Record<string, string> = {
  scheduled: 'bg-teal-50 text-teal-800 ring-teal-600/20',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-600/20',
}

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status
}

function getStatusClass(status: string) {
  return statusClasses[status] ?? 'bg-slate-50 text-slate-700 ring-slate-600/20'
}

function toDateTimeLocalValue(date: string) {
  return formatAppointmentDateTimeLocalInput(date)
}

export default function MyAppointments() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [reschedulingAppointment, setReschedulingAppointment] =
    useState<Appointment | null>(null)
  const [reviewingAppointment, setReviewingAppointment] =
    useState<Appointment | null>(null)
  const [reviewedAppointments, setReviewedAppointments] = useState<
    Record<string, boolean>
  >({})
  const [newAppointmentDate, setNewAppointmentDate] = useState('')
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [modalErrorMessage, setModalErrorMessage] = useState('')
  const [reviewErrorMessage, setReviewErrorMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const data = await getPatientAppointments()
      setAppointments(data)

      const completedAppointments = data.filter(
        (appointment) => appointment.status === 'completed',
      )
      const reviewEntries = await Promise.all(
        completedAppointments.map(async (appointment) => {
          const review = await getPatientReviewForAppointment(appointment.id)

          return [appointment.id, Boolean(review)] as const
        }),
      )

      setReviewedAppointments(Object.fromEntries(reviewEntries))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر تحميل المواعيد. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAppointments()
  }, [fetchAppointments])

  const openRescheduleModal = (appointment: Appointment) => {
    setReschedulingAppointment(appointment)
    setNewAppointmentDate(toDateTimeLocalValue(appointment.appointment_date))
    setModalErrorMessage('')
    setSuccessMessage('')
    setErrorMessage('')
  }

  const closeRescheduleModal = () => {
    if (isRescheduling) {
      return
    }

    setReschedulingAppointment(null)
    setNewAppointmentDate('')
    setModalErrorMessage('')
  }

  const openReviewModal = (appointment: Appointment) => {
    setReviewingAppointment(appointment)
    setReviewRating(0)
    setReviewComment('')
    setReviewErrorMessage('')
    setSuccessMessage('')
    setErrorMessage('')
  }

  const closeReviewModal = () => {
    if (isSubmittingReview) {
      return
    }

    setReviewingAppointment(null)
    setReviewRating(0)
    setReviewComment('')
    setReviewErrorMessage('')
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm('هل أنت متأكد من إلغاء هذا الموعد؟')

    if (!confirmed) {
      return
    }

    setCancellingId(appointmentId)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await cancelAppointment(appointmentId)
      setSuccessMessage('تم إلغاء الموعد بنجاح.')
      await fetchAppointments()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر إلغاء الموعد. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setCancellingId(null)
    }
  }

  const handleRescheduleAppointment = async () => {
    if (!reschedulingAppointment) {
      return
    }

    setModalErrorMessage('')

    if (!newAppointmentDate) {
      setModalErrorMessage('يرجى اختيار تاريخ ووقت الموعد الجديد.')
      return
    }

    const selectedDate = new Date(newAppointmentDate)

    if (Number.isNaN(selectedDate.getTime())) {
      setModalErrorMessage('يرجى اختيار تاريخ ووقت صحيحين.')
      return
    }

    if (selectedDate.getTime() <= Date.now()) {
      setModalErrorMessage('يجب أن يكون الموعد الجديد في المستقبل.')
      return
    }

    setIsRescheduling(true)

    try {
      const updatedAppointment = await rescheduleAppointment(
        reschedulingAppointment.id,
        buildAppointmentDateTime(
          newAppointmentDate.slice(0, 10),
          newAppointmentDate.slice(11, 16),
        ),
      )

      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === updatedAppointment.id ? updatedAppointment : appointment,
        ),
      )
      setSuccessMessage('تمت إعادة جدولة الموعد بنجاح.')
      setReschedulingAppointment(null)
      setNewAppointmentDate('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إعادة جدولة الموعد. يرجى المحاولة مرة أخرى.'
      setModalErrorMessage(message)
    } finally {
      setIsRescheduling(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!reviewingAppointment) {
      return
    }

    setReviewErrorMessage('')

    if (!reviewingAppointment.doctor_id) {
      setReviewErrorMessage('لا يمكن تقييم هذا الموعد لعدم توفر بيانات الطبيب.')
      return
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewErrorMessage('يرجى اختيار تقييم من 1 إلى 5 نجوم.')
      return
    }

    setIsSubmittingReview(true)

    try {
      await createDoctorReview({
        appointment_id: reviewingAppointment.id,
        doctor_id: reviewingAppointment.doctor_id,
        rating: reviewRating,
        comment: reviewComment,
      })

      setReviewedAppointments((currentReviews) => ({
        ...currentReviews,
        [reviewingAppointment.id]: true,
      }))
      setSuccessMessage('تم إرسال التقييم بنجاح.')
      setReviewingAppointment(null)
      setReviewRating(0)
      setReviewComment('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إرسال التقييم. يرجى المحاولة مرة أخرى.'
      setReviewErrorMessage(message)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">نظام المواعيد الطبية</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
              مواعيدي
            </h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              استعرض جميع مواعيدك الطبية وتابع حالتها أو ألغ المواعيد المجدولة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/patient/dashboard')}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            ← رجوع إلى لوحة المريض
          </button>
        </header>

        {successMessage ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {isLoading ? (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              جاري تحميل المواعيد...
            </p>
          ) : appointments.length > 0 ? (
            <div className="grid gap-4">
              {appointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                      <div>
                        <p className="text-xs font-bold text-slate-500">الطبيب</p>
                        <p className="mt-1 text-sm font-bold text-slate-950">
                          {appointment.doctor_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500">التخصص</p>
                        <p className="mt-1 text-sm text-slate-700">{appointment.specialty}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500">تاريخ الموعد</p>
                        <div className="mt-1 flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1 text-xl font-black text-teal-700">
                            <span>
                              {formatLocalAppointmentTime(appointment.appointment_date)}
                            </span>
                            <span aria-hidden="true">⏰</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold text-slate-500">
                            <span>
                              {formatLocalAppointmentDate(appointment.appointment_date)}
                            </span>
                            <span aria-hidden="true">📅</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500">الحالة</p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${getStatusClass(
                            appointment.status,
                          )}`}
                        >
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>
                    </div>

                    {appointment.status === 'scheduled' ||
                    appointment.status === 'completed' ? (
                      <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
                        {appointment.status === 'completed' ? (
                          reviewedAppointments[appointment.id] ? (
                            <span className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
                              تم التقييم
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openReviewModal(appointment)}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800"
                            >
                              تقييم الطبيب
                            </button>
                          )
                        ) : null}

                        {appointment.status === 'scheduled' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openRescheduleModal(appointment)}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 px-4 text-sm font-bold text-teal-800 transition hover:bg-teal-100"
                            >
                              إعادة الجدولة
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleCancelAppointment(appointment.id)}
                              disabled={cancellingId === appointment.id}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancellingId === appointment.id ? 'جاري الإلغاء...' : 'إلغاء الموعد'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {appointment.notes ? (
                    <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold text-slate-500">ملاحظات</p>
                      <p className="mt-1 text-sm leading-7 text-slate-700">{appointment.notes}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              لا توجد مواعيد
            </p>
          )}
        </section>
      </div>

      {reschedulingAppointment ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 id="reschedule-title" className="text-xl font-bold text-slate-950">
              إعادة جدولة الموعد
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              اختر تاريخا ووقتا جديدين للموعد مع {reschedulingAppointment.doctor_name}.
            </p>

            <div className="mt-5 grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="newAppointmentDate">
                تاريخ ووقت الموعد الجديد
              </label>
              <input
                id="newAppointmentDate"
                type="datetime-local"
                value={newAppointmentDate}
                onChange={(event) => setNewAppointmentDate(event.target.value)}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                required
              />
            </div>

            {modalErrorMessage ? (
              <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                {modalErrorMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRescheduleModal}
                disabled={isRescheduling}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleRescheduleAppointment()}
                disabled={isRescheduling}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRescheduling ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewingAppointment ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 id="review-title" className="text-xl font-bold text-slate-950">
              تقييم الطبيب
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              قيّم تجربتك مع {reviewingAppointment.doctor_name}.
            </p>

            <div className="mt-5 grid gap-2">
              <p className="text-sm font-bold text-slate-800">التقييم</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className={`text-3xl transition ${
                      rating <= reviewRating ? 'text-amber-400' : 'text-slate-300'
                    }`}
                    aria-label={`${rating} نجوم`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="reviewComment">
                تعليق اختياري
              </label>
              <textarea
                id="reviewComment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                className="min-h-28 resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                placeholder="اكتب ملاحظتك عن التجربة"
              />
            </div>

            {reviewErrorMessage ? (
              <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                {reviewErrorMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={isSubmittingReview}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitReview()}
                disabled={isSubmittingReview}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingReview ? 'جاري الإرسال...' : 'إرسال التقييم'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
