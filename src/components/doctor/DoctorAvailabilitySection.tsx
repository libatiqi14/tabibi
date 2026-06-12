import { useEffect, useState } from 'react'
import {
  getDoctorAvailability,
  saveDoctorAvailability,
  type DoctorAvailability,
  type SaveDoctorAvailabilityInput,
} from '../../services/availability'

const weekDays = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
]

type AvailabilityFormRow = {
  day_of_week: number
  start_time: string
  end_time: string
  active: boolean
}

type DoctorAvailabilitySectionProps = {
  doctorId: string
}

function buildDefaultRows(): AvailabilityFormRow[] {
  return weekDays.map((day) => ({
    day_of_week: day.value,
    start_time: '09:00',
    end_time: '18:00',
    active: day.value >= 1 && day.value <= 5,
  }))
}

function mergeAvailability(
  rows: AvailabilityFormRow[],
  availability: DoctorAvailability[],
) {
  return rows.map((row) => {
    const savedRow = availability.find(
      (item) => item.day_of_week === row.day_of_week,
    )

    if (!savedRow) {
      return row
    }

    return {
      day_of_week: savedRow.day_of_week,
      start_time: savedRow.start_time.slice(0, 5),
      end_time: savedRow.end_time.slice(0, 5),
      active: savedRow.active,
    }
  })
}

export default function DoctorAvailabilitySection({
  doctorId,
}: DoctorAvailabilitySectionProps) {
  const [rows, setRows] = useState<AvailabilityFormRow[]>(buildDefaultRows)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadAvailability = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const availability = await getDoctorAvailability(doctorId)

        if (isMounted) {
          setRows((currentRows) => mergeAvailability(currentRows, availability))
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل ساعات العمل. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAvailability()

    return () => {
      isMounted = false
    }
  }, [doctorId])

  const updateRow = (
    dayOfWeek: number,
    values: Partial<Omit<AvailabilityFormRow, 'day_of_week'>>,
  ) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.day_of_week === dayOfWeek ? { ...row, ...values } : row,
      ),
    )
  }

  const handleSave = async () => {
    setErrorMessage('')
    setSuccessMessage('')

    const invalidRow = rows.find(
      (row) => row.active && row.start_time >= row.end_time,
    )

    if (invalidRow) {
      setErrorMessage('وقت بداية العمل يجب أن يكون قبل وقت النهاية.')
      return
    }

    setIsSaving(true)

    try {
      const payload: SaveDoctorAvailabilityInput[] = rows.map((row) => ({
        doctor_id: doctorId,
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        active: row.active,
      }))

      const savedAvailability = await saveDoctorAvailability(payload)
      setRows((currentRows) => mergeAvailability(currentRows, savedAvailability))
      setSuccessMessage('تم حفظ ساعات العمل بنجاح.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر حفظ ساعات العمل. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-normal text-slate-950">
            ساعات العمل
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            حدد الأوقات التي يمكن للمرضى حجز المواعيد فيها.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isLoading || isSaving}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ ساعات العمل'}
        </button>
      </div>

      {errorMessage ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
          جاري تحميل ساعات العمل...
        </p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const day = weekDays.find((item) => item.value === row.day_of_week)

            return (
              <article
                key={row.day_of_week}
                className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center"
              >
                <label className="flex items-center gap-3 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(event) =>
                      updateRow(row.day_of_week, {
                        active: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  {day?.label}
                </label>

                <div className="grid gap-1">
                  <label className="text-xs font-bold text-slate-600">
                    بداية العمل
                  </label>
                  <input
                    type="time"
                    value={row.start_time}
                    onChange={(event) =>
                      updateRow(row.day_of_week, {
                        start_time: event.target.value,
                      })
                    }
                    disabled={!row.active}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-xs font-bold text-slate-600">
                    نهاية العمل
                  </label>
                  <input
                    type="time"
                    value={row.end_time}
                    onChange={(event) =>
                      updateRow(row.day_of_week, {
                        end_time: event.target.value,
                      })
                    }
                    disabled={!row.active}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
                    row.active
                      ? 'bg-teal-50 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {row.active ? 'متاح' : 'غير متاح'}
                </span>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
