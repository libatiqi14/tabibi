import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAppointment } from '../../services/appointments'
import {
  getDoctorDaySlots,
  type DoctorDaySlot,
} from '../../services/availability'
import { getDoctorsByCityAndSpecialty, type Doctor } from '../../services/doctors'
import {
  getDoctorReviews,
  getDoctorReviewStats,
  type DoctorReview,
  type DoctorReviewStats,
} from '../../services/reviews'
import { MEDICAL_SPECIALTIES, getSpecialtyMeta } from '../../utils/specialties'
import { MOROCCAN_CITIES } from '../../utils/cities'
import {
  buildAppointmentDateTime,
  formatAppointmentDateInput,
} from '../../utils/dateTime'

function getTodayInputValue() {
  return formatAppointmentDateInput()
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
    normalizedMessage.includes('doctor is unavailable on this day') ||
    normalizedMessage.includes('unavailable on this day')
  ) {
    return 'الطبيب غير متاح في هذا اليوم. يرجى اختيار تاريخ آخر.'
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
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [reviewStatsByDoctorId, setReviewStatsByDoctorId] = useState<
    Record<string, DoctorReviewStats>
  >({})
  const [reviewsByDoctorId, setReviewsByDoctorId] = useState<
    Record<string, DoctorReview[]>
  >({})
  const [daySlots, setDaySlots] = useState<DoctorDaySlot[]>([])
  const [city, setCity] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [appointmentDay, setAppointmentDay] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDoctorProfile, setShowDoctorProfile] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setShowDoctorProfile(false)
  }, [doctorId])

  useEffect(() => {
    let isMounted = true

    const loadDoctors = async () => {
      if (!city || !specialty) {
        setDoctors([])
        setReviewStatsByDoctorId({})
        setReviewsByDoctorId({})
        setDoctorId('')
        setDaySlots([])
        setSelectedSlot('')
        return
      }

      setIsLoadingDoctors(true)
      setDoctorId('')
      setDaySlots([])
      setSelectedSlot('')
      setReviewStatsByDoctorId({})
      setReviewsByDoctorId({})
      setErrorMessage('')

      try {
        const data = await getDoctorsByCityAndSpecialty(city, specialty)
        const reviewEntries = await Promise.all(
          data.map(async (doctor) => {
            const [stats, reviews] = await Promise.all([
              getDoctorReviewStats(doctor.id),
              getDoctorReviews(doctor.id),
            ])

            return [doctor.id, stats, reviews] as const
          }),
        )

        if (isMounted) {
          setDoctors(data)
          setReviewStatsByDoctorId(
            Object.fromEntries(
              reviewEntries.map(([doctorId, stats]) => [doctorId, stats]),
            ),
          )
          setReviewsByDoctorId(
            Object.fromEntries(
              reviewEntries.map(([doctorId, , reviews]) => [doctorId, reviews]),
            ),
          )
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
  }, [city, specialty])

  useEffect(() => {
    let isMounted = true

    const loadSlots = async () => {
      if (!doctorId || !appointmentDay) {
        setDaySlots([])
        setSelectedSlot('')
        return
      }

      setIsLoadingSlots(true)
      setDaySlots([])
      setSelectedSlot('')
      setErrorMessage('')

      try {
        const sqlDate = toSqlDate(appointmentDay)

        console.log('BOOKING SELECTED DOCTOR ID', doctorId)
        console.log('BOOKING SELECTED DATE', sqlDate)

        const slots = await getDoctorDaySlots(doctorId, sqlDate)

        console.log('BOOKING RETURNED DAY SLOTS', slots)

        if (isMounted) {
          setDaySlots(slots)
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
    setCity('')
    setSpecialty('')
    setDoctorId('')
    setDoctors([])
    setReviewStatsByDoctorId({})
    setReviewsByDoctorId({})
    setAppointmentDay('')
    setDaySlots([])
    setSelectedSlot('')
    setNotes('')
  }

  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId)
  const selectedDoctorReviewStats = selectedDoctor
    ? reviewStatsByDoctorId[selectedDoctor.id]
    : undefined
  const selectedDoctorReviews = selectedDoctor
    ? reviewsByDoctorId[selectedDoctor.id] ?? []
    : []
  const selectedDaySlot = daySlots.find((slot) => slot.slot_start === selectedSlot)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!city || !specialty || !selectedDoctor || !appointmentDay || !selectedSlot) {
      setErrorMessage('يرجى تعبئة جميع الحقول المطلوبة.')
      return
    }

    if (!selectedDaySlot || selectedDaySlot.status !== 'available') {
      setErrorMessage('يرجى اختيار وقت متاح.')
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
        appointment_date: buildAppointmentDateTime(sqlDate, selectedTime),
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

  const doctorSelectDisabled =
    !city || !specialty || isLoadingDoctors || doctors.length === 0

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              نظام المواعيد الطبية
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
              حجز موعد جديد
            </h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              اختر التخصص والطبيب ثم اختر يوما ووقتا متاحا من جدول الطبيب.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/patient/dashboard')}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← رجوع إلى لوحة المريض
          </button>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="city">
                {'\u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
              </label>
              <select
                id="city"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value)
                  setSpecialty('')
                  setDoctorId('')
                  setDoctors([])
                  setDaySlots([])
                  setSelectedSlot('')
                }}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                required
              >
                <option value="">
                  {'\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
                </option>
                {MOROCCAN_CITIES.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="specialty">
                التخصص
              </label>
              <select
                id="specialty"
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                disabled={!city}
                className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                required
              >
                <option value="">
                  {city
                    ? '\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u062E\u0635\u0635'
                    : '\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0623\u0648\u0644\u0627\u064B'}
                </option>
                {MEDICAL_SPECIALTIES.map((item) => {
                  const meta = getSpecialtyMeta(item)

                  return (
                    <option key={item} value={item}>
                      {meta.icon} {meta.labelAr}
                    </option>
                  )
                })}
              </select>
            </div>

            {city && specialty && !isLoadingDoctors && doctors.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                {'\u0644\u0627 \u064A\u0648\u062C\u062F \u0623\u0637\u0628\u0627\u0621 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062A\u062E\u0635\u0635 \u062F\u0627\u062E\u0644 \u0647\u0630\u0647 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u062D\u0627\u0644\u064A\u0627\u064B'}
              </p>
            ) : null}

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
                  {!city
                    ? '\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0623\u0648\u0644\u0627'
                    : !specialty
                      ? '\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u062E\u0635\u0635 \u0623\u0648\u0644\u0627'
                    : isLoadingDoctors
                      ? 'جاري تحميل الأطباء...'
                      : doctors.length === 0
                        ? '\u0644\u0627 \u064A\u0648\u062C\u062F \u0623\u0637\u0628\u0627\u0621 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062A\u062E\u0635\u0635 \u062F\u0627\u062E\u0644 \u0647\u0630\u0647 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u062D\u0627\u0644\u064A\u0627\u064B'
                        : '\u0627\u062E\u062A\u0631 \u0627\u0644\u0637\u0628\u064A\u0628'}
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
              <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="grid min-h-24 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-xl font-bold text-teal-800 ring-1 ring-teal-100 sm:h-20 sm:w-20">
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

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">
                      {selectedDoctor.full_name}
                    </h2>
                    <p className="mt-1 truncate text-sm font-bold text-teal-700">
                      {getSpecialtyMeta(selectedDoctor.specialty).icon}{' '}
                      {getSpecialtyMeta(selectedDoctor.specialty).labelAr}
                    </p>
                    {selectedDoctor.city ? (
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500 sm:text-sm">
                        {'\uD83D\uDCCD '}
                        {selectedDoctor.city}
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-xs font-bold text-amber-600 sm:text-sm">
                      {selectedDoctorReviewStats?.reviewCount
                        ? `⭐ ${selectedDoctorReviewStats.averageRating?.toFixed(1)} (${selectedDoctorReviewStats.reviewCount} تقييم)`
                        : 'لا توجد تقييمات بعد'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDoctorId('')}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 sm:px-3 sm:text-xs"
                    >
                      تغيير الطبيب
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDoctorProfile(true)}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg bg-teal-50 px-2 text-[11px] font-bold text-teal-700 transition hover:bg-teal-100 sm:px-3 sm:text-xs"
                    >
                      عرض الملف الكامل
                    </button>
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

            <div className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-bold text-slate-800">
                  الوقت المتاح
                </label>
                <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600">
                  <span>🟢 متاح</span>
                  <span>🔴 محجوز</span>
                </div>
              </div>

              {!doctorId ? (
                <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  اختر الطبيب أولا
                </p>
              ) : !appointmentDay ? (
                <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  اختر التاريخ أولا
                </p>
              ) : isLoadingSlots ? (
                <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  جاري تحميل الأوقات المتاحة...
                </p>
              ) : daySlots.length > 0 ? (
                <div className="grid gap-3">
                  {daySlots.every((slot) => slot.status === 'booked') ? (
                    <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      جميع الأوقات محجوزة في هذا اليوم
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {daySlots.map((slot) => {
                      const isSelected = selectedSlot === slot.slot_start
                      const isBooked = slot.status === 'booked'

                      return (
                        <button
                          key={`${slot.slot_start}-${slot.status}`}
                          type="button"
                          onClick={() => {
                            if (!isBooked) {
                              setSelectedSlot(slot.slot_start)
                            }
                          }}
                          disabled={isBooked}
                          className={`min-h-11 rounded-lg border px-3 text-sm font-bold transition ${
                            isSelected
                              ? 'border-teal-700 bg-teal-700 text-white shadow-md'
                              : isBooked
                                ? 'cursor-not-allowed border-rose-300 bg-rose-50 text-rose-600 opacity-70'
                                : 'cursor-pointer border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {getSlotTime(slot.slot_start)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                  لا توجد أوقات عمل في هذا اليوم أو الطبيب غير متاح
                </p>
              )}
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

      {showDoctorProfile && selectedDoctor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-profile-title"
          onClick={() => setShowDoctorProfile(false)}
        >
          <section
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-xl font-bold text-teal-800 ring-1 ring-teal-100">
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
                <div className="min-w-0">
                  <h2
                    id="doctor-profile-title"
                    className="truncate text-xl font-black text-slate-950"
                  >
                    {selectedDoctor.full_name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-teal-700">
                    {getSpecialtyMeta(selectedDoctor.specialty).icon}{' '}
                    {getSpecialtyMeta(selectedDoctor.specialty).labelAr}
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber-600">
                    {selectedDoctorReviewStats?.reviewCount
                      ? `⭐ ${selectedDoctorReviewStats.averageRating?.toFixed(1)} (${selectedDoctorReviewStats.reviewCount} تقييم)`
                      : 'لا توجد تقييمات بعد'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDoctorProfile(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xl font-bold text-slate-700 transition hover:bg-slate-50"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-bold text-slate-500">المدينة</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {selectedDoctor.city ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">العنوان</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {selectedDoctor.address ?? selectedDoctor.clinic_name ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">سنوات الخبرة</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {selectedDoctor.years_experience != null
                    ? `${selectedDoctor.years_experience} سنة`
                    : 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">كلية الطب</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {selectedDoctor.medical_school ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">سنة التخرج</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {selectedDoctor.graduation_year ?? 'غير متوفر'}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">المستشفيات السابقة</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {joinList(selectedDoctor.previous_hospitals)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-bold text-slate-500">نبذة مهنية</dt>
                <dd className="mt-1 leading-7 text-slate-700">
                  {selectedDoctor.biography ?? 'غير متوفر'}
                </dd>
              </div>
            </dl>

            {selectedDoctorReviews.some((review) => review.comment) ? (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <h3 className="font-black text-slate-950">أحدث تعليقات المرضى</h3>
                <div className="mt-3 grid gap-2">
                  {selectedDoctorReviews
                    .filter((review) => review.comment)
                    .slice(0, 3)
                    .map((review) => (
                      <blockquote
                        key={review.id}
                        className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
                      >
                        <span className="font-bold text-amber-600">
                          {'★'.repeat(review.rating)}
                        </span>{' '}
                        {review.comment}
                      </blockquote>
                    ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowDoctorProfile(false)}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              إغلاق
            </button>
          </section>
        </div>
      ) : null}
    </main>
  )
}
