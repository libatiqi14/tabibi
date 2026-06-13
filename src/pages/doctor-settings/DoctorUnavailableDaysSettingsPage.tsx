import { useEffect, useState } from 'react'
import {
  getCurrentDoctor,
  type DoctorProfile,
} from '../../services/doctor'
import {
  addDoctorUnavailableDay,
  deleteDoctorUnavailableDay,
  getDoctorUnavailableDays,
  type DoctorUnavailableDay,
} from '../../services/doctorUnavailableDays'
import DoctorSettingsLayout from './DoctorSettingsLayout'

const dateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
})

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`))
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function getUnavailableDayErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('doctor_unavailable_days_unique_date')
  ) {
    return 'هذا اليوم مسجل بالفعل ضمن أيام العطل والإجازات.'
  }

  return message || 'تعذر حفظ يوم العطلة. يرجى المحاولة مرة أخرى.'
}

export default function DoctorUnavailableDaysSettingsPage() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [unavailableDays, setUnavailableDays] = useState<DoctorUnavailableDay[]>([])
  const [unavailableDate, setUnavailableDate] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const doctorProfile = await getCurrentDoctor()
        const days = await getDoctorUnavailableDays(doctorProfile.id)

        if (isMounted) {
          setDoctor(doctorProfile)
          setUnavailableDays(days)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل أيام العطل والإجازات. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const handleAddUnavailableDay = async () => {
    if (!doctor) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    if (!unavailableDate) {
      setErrorMessage('يرجى اختيار تاريخ يوم العطلة.')
      return
    }

    setIsSaving(true)

    try {
      const newUnavailableDay = await addDoctorUnavailableDay({
        doctor_id: doctor.id,
        unavailable_date: unavailableDate,
        reason,
      })

      setUnavailableDays((currentDays) =>
        [...currentDays, newUnavailableDay].sort((firstDay, secondDay) =>
          firstDay.unavailable_date.localeCompare(secondDay.unavailable_date),
        ),
      )
      setUnavailableDate('')
      setReason('')
      setSuccessMessage('تمت إضافة يوم العطلة بنجاح.')
    } catch (error) {
      setErrorMessage(getUnavailableDayErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteUnavailableDay = async (id: string) => {
    const confirmed = window.confirm('هل تريد حذف هذا اليوم من أيام العطل؟')

    if (!confirmed) {
      return
    }

    setDeletingId(id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await deleteDoctorUnavailableDay(id)
      setUnavailableDays((currentDays) =>
        currentDays.filter((day) => day.id !== id),
      )
      setSuccessMessage('تم حذف يوم العطلة بنجاح.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر حذف يوم العطلة. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <DoctorSettingsLayout
      title="أيام العطل والإجازات"
      description="حدد الأيام التي لا تستقبل فيها مواعيد."
    >
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

      {isLoading ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm">
          جاري تحميل أيام العطل والإجازات...
        </p>
      ) : (
        <section className="grid gap-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="grid gap-2">
                <label
                  className="text-sm font-bold text-slate-800"
                  htmlFor="unavailableDate"
                >
                  التاريخ
                </label>
                <input
                  id="unavailableDate"
                  type="date"
                  value={unavailableDate}
                  min={getTodayInputValue()}
                  onChange={(event) => setUnavailableDate(event.target.value)}
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-sm font-bold text-slate-800"
                  htmlFor="unavailableReason"
                >
                  السبب
                </label>
                <input
                  id="unavailableReason"
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                  placeholder="اختياري"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleAddUnavailableDay()}
                disabled={isSaving || !doctor}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'جاري الإضافة...' : 'إضافة يوم عطلة'}
              </button>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold tracking-normal text-slate-950">
              الأيام غير المتاحة
            </h2>

            {unavailableDays.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {unavailableDays.map((day) => (
                  <article
                    key={day.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-bold text-slate-950">
                        {formatDate(day.unavailable_date)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {day.reason || 'بدون سبب محدد'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeleteUnavailableDay(day.id)}
                      disabled={deletingId === day.id}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === day.id ? 'جاري الحذف...' : 'حذف'}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
                لا توجد أيام عطلة مسجلة حالياً
              </p>
            )}
          </section>
        </section>
      )}
    </DoctorSettingsLayout>
  )
}
