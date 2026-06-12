import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAppointment } from '../../services/appointments'
import {
  getAvailableSlots,
  type AvailableSlot,
} from '../../services/availability'
import {
  getDoctorsBySpecialty,
  getSpecialties,
  type Doctor,
} from '../../services/doctors'

const WORKING_DAY_START_MINUTES = 9 * 60
const WORKING_DAY_END_MINUTES = 18 * 60
const SLOT_INTERVAL_MINUTES = 10

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function toSqlDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  const dayMonthYearMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (dayMonthYearMatch) {
    const [, day, month, year] = dayMonthYearMatch
    return `${year}-${month}-${day}`
  }

  return date
}

function getSlotMinutes(slotStart: string) {
  const [hours = '0', minutes = '0'] = slotStart.slice(0, 5).split(':')

  return Number(hours) * 60 + Number(minutes)
}

function isAllowedSlot(slot: AvailableSlot) {
  const slotTime = slot.slot_start.slice(0, 5)
  const minutes = getSlotMinutes(slotTime)

  return (
    /^\d{2}:\d{2}$/.test(slotTime) &&
    minutes >= WORKING_DAY_START_MINUTES &&
    minutes < WORKING_DAY_END_MINUTES &&
    minutes % SLOT_INTERVAL_MINUTES === 0
  )
}

function getSlotTime(slotStart: string) {
  return slotStart.slice(0, 5)
}

function joinList(value?: string[] | null) {
  return value && value.length > 0 ? value.join('، ') : 'غير متوفر'
}

function getBookingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('appointments_no_double_booking_idx')
  ) {
    return 'هذا الموعد محجوز بالفعل. يرجى اختيار وقت آخر.'
  }

  if (
    normalizedMessage.includes('doctor_not_available') ||
    normalizedMessage.includes('working hours')
  ) {
    return 'الطبيب غير متاح في هذا الوقت. يرجى اختيار وقت آخر.'
  }

  return message || 'تعذر حجز الموعد. يرجى المحاولة مرة أخرى.'
}

export default function BookAppointment() {
  const navigate = useNavigate()
  const redirectTimeoutRef = useRef<number | null>(null)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [specialty, setSpecialty] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [appointmentDay, setAppointmentDay] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true)
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadSpecialties = async () => {
      setIsLoadingSpecialties(true)
      setErrorMessage('')

      try {
        const data = await getSpecialties()

        if (isMounted) {
          setSpecialties(data)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل التخصصات. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoadingSpecialties(false)
        }
      }
    }

    void loadSpecialties()

    return () => {
      isMounted = false

      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadDoctors = async () => {
      if (!specialty) {
        setDoctors([])
        setDoctorId('')
        setAvailableSlots([])
        setSelectedSlot('')
        return
      }

      setIsLoadingDoctors(true)
      setDoctorId('')
      setAvailableSlots([])
      setSelectedSlot('')
      setErrorMessage('')

      try {
        const data = await getDoctorsBySpecialty(specialty)

        if (isMounted) {
          setDoctors(data)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الأطباء. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
          setDoctors([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingDoctors(false)
        }
      }
    }

    void loadDoctors()

    return () => {
      isMounted = false
    }
  }, [specialty])

  useEffect(() => {
    let isMounted = true

    const loadSlots = async () => {
      if (!doctorId || !appointmentDay) {
        setAvailableSlots([])
        setSelectedSlot('')
        return
      }

      setIsLoadingSlots(true)
      setAvailableSlots([])
      setSelectedSlot('')
      setErrorMessage('')

      try {
        const sqlDate = toSqlDate(appointmentDay)

        console.log('BOOKING SELECTED DOCTOR ID', doctorId)
        console.log('BOOKING SELECTED DATE', sqlDate)

        const slots = await getAvailableSlots(doctorId, sqlDate)

        console.log('BOOKING RETURNED AVAILABLE SLOTS', slots)

        if (isMounted) {
          setAvailableSlots(slots.filter(isAllowedSlot))
        }
      } catch (error) {
        console.log('BOOKING AVAILABLE SLOTS RPC ERROR', error)

        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الأوقات المتاحة. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoadingSlots(false)
        }
      }
    }

    void loadSlots()

    return () => {
      isMounted = false
    }
  }, [doctorId, appointmentDay])

  const resetForm = () => {
    setSpecialty('')
    setDoctorId('')
    setDoctors([])
    setAppointmentDay('')
    setAvailableSlots([])
    setSelectedSlot('')
    setNotes('')
  }

  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!specialty || !selectedDoctor || !appointmentDay || !selectedSlot) {
      setErrorMessage('يرجى تعبئة جميع الحقول المطلوبة.')
      return
    }

    setIsSubmitting(true)

    try {
      const sqlDate = toSqlDate(appointmentDay)
      const selectedTime = getSlotTime(selectedSlot)

      await createAppointment({
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.full_name,
        specialty,
        appointment_date: `${sqlDate}T${selectedTime}:00`,
        notes: notes.trim() || null,
      })

      resetForm()
      setSuccessMessage(
        'تم حجز الموعد بنجاح. سيتم تحويلك إلى لوحة التحكم.',
      )
      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate('/patient/dashboard')
      }, 900)
    } catch (error) {
      setErrorMessage(getBookingErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const doctorSelectDisabled = !specialty || isLoadingDoctors || doctors.length === 0
  const slotsDisabled = !doctorId || !appointmentDay || isLoadingSlots

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-teal-700">
            نظام المواعيد الطبية
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
            حجز موعد جديد
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            اختر التخصص والطبيب ثم اختر يوما ووقتا متاحا من جدول الطبيب.
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="specialty">
                التخصص
              </label>
              <select
                id="specialty"
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                disabled={isLoadingSpecialties}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                required
              >
                <option value="">
                  {isLoadingSpecialties
                    ? 'جاري تحميل التخصصات...'
                    : 'اختر التخصص'}
                </option>
                {specialties.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="doctor">
                الطبيب
              </label>
              <select
                id="doctor"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                disabled={doctorSelectDisabled}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                required
              >
                <option value="">
                  {!specialty
                    ? 'اختر التخصص أولا'
                    : isLoadingDoctors
                      ? 'جاري تحميل الأطباء...'
                      : doctors.length === 0
                        ? 'لا يوجد أطباء لهذا التخصص'
                        : 'اختر الطبيب'}
                </option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.clinic_name
                      ? `${doctor.full_name} - ${doctor.clinic_name}`
                      : doctor.full_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedDoctor ? (
              <article className="rounded-lg border border-teal-100 bg-teal-50/60 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-xl font-bold text-teal-800 ring-1 ring-teal-100">
                    {selectedDoctor.avatar_url ? (
                      <img
                        src={selectedDoctor.avatar_url}
                        alt={selectedDoctor.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      selectedDoctor.full_name.slice(0, 1)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-slate-950">
                      {selectedDoctor.full_name}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-teal-800">
                      {selectedDoctor.specialty}
                    </p>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-bold text-slate-600">سنوات الخبرة</dt>
                        <dd className="mt-1 text-slate-950">
                          {selectedDoctor.years_experience != null
                            ? `${selectedDoctor.years_experience} سنة`
                            : 'غير متوفر'}
                        </dd>
                      </div>

                      <div>
                        <dt className="font-bold text-slate-600">كلية الطب</dt>
                        <dd className="mt-1 text-slate-950">
                          {selectedDoctor.medical_school ?? 'غير متوفر'}
                        </dd>
                      </div>

                      <div className="sm:col-span-2">
                        <dt className="font-bold text-slate-600">
                          المستشفيات السابقة
                        </dt>
                        <dd className="mt-1 text-slate-950">
                          {joinList(selectedDoctor.previous_hospitals)}
                        </dd>
                      </div>

                      <div className="sm:col-span-2">
                        <dt className="font-bold text-slate-600">نبذة مهنية</dt>
                        <dd className="mt-1 leading-7 text-slate-700">
                          {selectedDoctor.biography ?? 'غير متوفر'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            ) : null}

            <div className="grid gap-2">
              <label
                className="text-sm font-bold text-slate-800"
                htmlFor="appointmentDay"
              >
                تاريخ الموعد
              </label>
              <input
                id="appointmentDay"
                type="date"
                value={appointmentDay}
                min={getTodayInputValue()}
                onChange={(event) => setAppointmentDay(event.target.value)}
                disabled={!doctorId}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="slot">
                الوقت المتاح
              </label>
              <select
                id="slot"
                value={selectedSlot}
                onChange={(event) => setSelectedSlot(event.target.value)}
                disabled={slotsDisabled || availableSlots.length === 0}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                required
              >
                <option value="">
                  {!doctorId
                    ? 'اختر الطبيب أولا'
                    : !appointmentDay
                      ? 'اختر التاريخ أولا'
                      : isLoadingSlots
                        ? 'جاري تحميل الأوقات المتاحة...'
                        : availableSlots.length === 0
                          ? 'لا توجد أوقات متاحة في هذا اليوم'
                          : 'اختر الوقت'}
                </option>
                {availableSlots.map((slot) => (
                  <option key={slot.slot_start} value={slot.slot_start}>
                    {slot.slot_start}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="notes">
                ملاحظات
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-32 resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                placeholder="أضف أي ملاحظات اختيارية"
              />
            </div>

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

            <button
              type="submit"
              disabled={isSubmitting || isLoadingSlots}
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'جاري حجز الموعد...' : 'حجز الموعد'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
