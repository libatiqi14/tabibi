import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NotificationsPanel from '../../components/notifications/NotificationsPanel'
import { useAuth } from '../../hooks/useAuth'
import {
  createAppointment,
  getPatientAppointments,
  type Appointment,
} from '../../services/appointments'
import {
  getDoctorDaySlots,
  type DoctorDaySlot,
} from '../../services/availability'
import {
  getFeaturedDoctors,
  getDoctorsBySpecialty,
  type FeaturedDoctor,
  type Doctor,
} from '../../services/doctors'
import { getUnreadNotificationsCount } from '../../services/notifications'
import {
  getDoctorReviews,
  getDoctorReviewStats,
  type DoctorReview,
  type DoctorReviewStats,
} from '../../services/reviews'
import { MEDICAL_SPECIALTIES, getSpecialtyMeta } from '../../utils/specialties'

const appointmentDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const reviewDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
})

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

function isAllowedSlot(slot: DoctorDaySlot) {
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

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    scheduled: 'مجدول',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }

  return labels[status] ?? status
}

type DoctorDirectoryItem = Doctor & {
  reviewStats: DoctorReviewStats
}

type BookableDoctor = DoctorDirectoryItem | FeaturedDoctor

const getDoctorInitials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((namePart) => namePart.charAt(0))
    .join('')
    .toUpperCase()

const formatList = (items?: string[] | null) =>
  items && items.length > 0 ? items.join('، ') : 'غير متوفر'

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

export default function PatientDashboard() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(true)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false)
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false)
  const [showDoctorsDirectory, setShowDoctorsDirectory] = useState(false)
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [doctors, setDoctors] = useState<DoctorDirectoryItem[]>([])
  const [featuredDoctors, setFeaturedDoctors] = useState<FeaturedDoctor[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [loadingFeaturedDoctors, setLoadingFeaturedDoctors] = useState(true)
  const [doctorsDirectoryError, setDoctorsDirectoryError] = useState('')
  const [activeBookingDoctorId, setActiveBookingDoctorId] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [daySlots, setDaySlots] = useState<DoctorDaySlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [expandedReviewsDoctorId, setExpandedReviewsDoctorId] = useState('')
  const [doctorReviews, setDoctorReviews] = useState<Record<string, DoctorReview[]>>(
    {},
  )
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchFeaturedDoctors = async () => {
      setLoadingFeaturedDoctors(true)

      try {
        const data = await getFeaturedDoctors(6)

        if (isMounted) {
          setFeaturedDoctors(data)
        }
      } catch (error) {
        console.error('Failed to load featured doctors', error)
      } finally {
        if (isMounted) {
          setLoadingFeaturedDoctors(false)
        }
      }
    }

    void fetchFeaturedDoctors()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!showAppointmentsModal) {
      return undefined
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAppointmentsModal(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)

    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showAppointmentsModal])

  useEffect(() => {
    if (!showNotificationsModal) {
      return undefined
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotificationsModal(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)

    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showNotificationsModal])

  useEffect(() => {
    if (!showMedicalRecordsModal) {
      return undefined
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMedicalRecordsModal(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)

    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showMedicalRecordsModal])

  useEffect(() => {
    let isMounted = true

    if (!selectedSpecialty) {
      setDoctors([])

      return () => {
        isMounted = false
      }
    }

    const fetchDoctors = async () => {
      setLoadingDoctors(true)
      setDoctorsDirectoryError('')

      try {
        const specialtyDoctors = await getDoctorsBySpecialty(selectedSpecialty)
        const doctorsWithStats = await Promise.all(
          specialtyDoctors.map(async (doctor) => ({
            ...doctor,
            reviewStats: await getDoctorReviewStats(doctor.id),
          })),
        )

        if (isMounted) {
          setDoctors(doctorsWithStats)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الأطباء. يرجى المحاولة مرة أخرى.'
          setDoctorsDirectoryError(message)
        }
      } finally {
        if (isMounted) {
          setLoadingDoctors(false)
        }
      }
    }

    void fetchDoctors()

    return () => {
      isMounted = false
    }
  }, [selectedSpecialty])

  useEffect(() => {
    let isMounted = true

    if (!activeBookingDoctorId || !bookingDate) {
      setDaySlots([])
      setBookingTime('')

      return () => {
        isMounted = false
      }
    }

    const fetchAvailableSlots = async () => {
      setLoadingSlots(true)
      setDaySlots([])
      setBookingTime('')
      setBookingError('')

      try {
        const sqlDate = toSqlDate(bookingDate)
        const slots = await getDoctorDaySlots(activeBookingDoctorId, sqlDate)

        if (isMounted) {
          setDaySlots(slots.filter(isAllowedSlot))
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الأوقات المتاحة. يرجى المحاولة مرة أخرى.'
          setBookingError(message)
        }
      } finally {
        if (isMounted) {
          setLoadingSlots(false)
        }
      }
    }

    void fetchAvailableSlots()

    return () => {
      isMounted = false
    }
  }, [activeBookingDoctorId, bookingDate])

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

  const resetInlineBookingForm = () => {
    setBookingDate('')
    setBookingTime('')
    setBookingNotes('')
    setDaySlots([])
    setBookingError('')
  }

  const handleToggleBookingForm = (doctorId: string) => {
    setBookingSuccess('')

    if (activeBookingDoctorId === doctorId) {
      setActiveBookingDoctorId('')
      resetInlineBookingForm()
      return
    }

    setActiveBookingDoctorId(doctorId)
    resetInlineBookingForm()
  }

  const handleToggleReviews = async (doctorId: string) => {
    setReviewsError('')

    if (expandedReviewsDoctorId === doctorId) {
      setExpandedReviewsDoctorId('')
      return
    }

    setExpandedReviewsDoctorId(doctorId)

    if (doctorReviews[doctorId]) {
      return
    }

    setLoadingReviews(true)

    try {
      const reviews = await getDoctorReviews(doctorId)
      setDoctorReviews((currentReviews) => ({
        ...currentReviews,
        [doctorId]: reviews,
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل التقييمات. يرجى المحاولة مرة أخرى.'
      setReviewsError(message)
    } finally {
      setLoadingReviews(false)
    }
  }

  const handleConfirmBooking = async (doctor: BookableDoctor) => {
    setBookingError('')
    setBookingSuccess('')

    if (!bookingDate || !bookingTime) {
      setBookingError('يرجى اختيار التاريخ والوقت المتاح.')
      return
    }

    setSubmittingBooking(true)

    try {
      const sqlDate = toSqlDate(bookingDate)
      const selectedTime = getSlotTime(bookingTime)
      const appointment = await createAppointment({
        doctor_id: doctor.id,
        doctor_name: doctor.full_name,
        specialty: doctor.specialty,
        appointment_date: `${sqlDate}T${selectedTime}:00`,
        notes: bookingNotes.trim() || null,
      })

      setAppointments((currentAppointments) =>
        [...currentAppointments, appointment].sort(
          (first, second) =>
            new Date(first.appointment_date).getTime() -
            new Date(second.appointment_date).getTime(),
        ),
      )
      resetInlineBookingForm()
      setActiveBookingDoctorId('')
      setBookingSuccess('تم حجز الموعد بنجاح')
    } catch (error) {
      setBookingError(getBookingErrorMessage(error))
    } finally {
      setSubmittingBooking(false)
    }
  }

  const renderBookingSlotGrid = () => (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold text-slate-800">الوقت المتاح</span>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600">
          <span>🟢 متاح</span>
          <span>🔴 محجوز</span>
        </div>
      </div>

      {!bookingDate ? (
        <p className="rounded-lg bg-white/70 px-4 py-4 text-sm font-semibold text-slate-600">
          اختر التاريخ أولاً
        </p>
      ) : loadingSlots ? (
        <p className="rounded-lg bg-white/70 px-4 py-4 text-sm font-semibold text-slate-600">
          جاري تحميل الأوقات...
        </p>
      ) : daySlots.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {daySlots.map((slot) => {
            const isSelected = bookingTime === slot.slot_start
            const isBooked = slot.status === 'booked'

            return (
              <button
                key={`${slot.slot_start}-${slot.status}`}
                type="button"
                onClick={() => {
                  if (!isBooked) {
                    setBookingTime(slot.slot_start)
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
      ) : (
        <p className="rounded-lg bg-white/70 px-4 py-4 text-sm font-semibold text-slate-600">
          لا توجد أوقات متاحة في هذا اليوم
        </p>
      )}
    </div>
  )

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-slate-50 to-teal-50/30 text-slate-950"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white text-2xl font-black text-teal-700 shadow-sm ring-1 ring-teal-100 sm:h-20 sm:w-20">
              T
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-teal-700">Tabibi</p>
              <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                لوحة المريض
              </h1>
              <p className="mt-3 text-base font-semibold leading-7 text-slate-700">
                مرحباً بك، تابع مواعيدك وأطبائك بسهولة.
              </p>
              <p className="mt-1 truncate text-sm text-slate-500">
                {authLoading
                  ? 'جاري تحميل بيانات الحساب...'
                  : user?.email ?? 'لا يوجد بريد إلكتروني'}
              </p>
            </div>
          </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate('/patient/book-appointment')}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md"
            >
              حجز موعد جديد
            </button>

            <button
              type="button"
              onClick={() => navigate('/patient/appointments')}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-white/80 px-5 text-sm font-bold text-teal-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50 hover:shadow-md"
            >
              مواعيدي
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={authLoading}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              تسجيل الخروج
            </button>
            </div>
          </div>
        </header>

        {bookingSuccess ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
            {bookingSuccess}
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setShowAppointmentsModal(true)}
            className={`group rounded-2xl border p-5 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
              showAppointmentsModal
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-teal-200'
            }`}
            aria-expanded={showAppointmentsModal}
          >
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-3xl ring-1 ring-teal-100 transition group-hover:bg-white">
                  📅
                </span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  المواعيد القادمة
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  راجع مواعيدك القادمة وحالاتها.
                </span>
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showAppointmentsModal ? '⌃' : '⌄'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-xl bg-teal-50 px-4 py-2 text-sm font-black text-teal-800 ring-1 ring-teal-100">
              {isFetchingAppointments
                ? 'جاري التحميل...'
                : `${upcomingAppointments.length} موعد`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowMedicalRecordsModal(true)}
            className={`group rounded-2xl border p-5 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
              showMedicalRecordsModal
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-teal-200'
            }`}
            aria-expanded={showMedicalRecordsModal}
          >
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl ring-1 ring-emerald-100 transition group-hover:bg-white">
                  📄
                </span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  السجلات الطبية
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  استعرض ملخصات الزيارات والوصفات والتقارير الطبية.
                </span>
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showMedicalRecordsModal ? '⌃' : '⌄'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
              لا توجد سجلات جديدة
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotificationsModal(true)}
            className={`group rounded-2xl border p-5 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
              showNotificationsModal
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-teal-200'
            }`}
            aria-expanded={showNotificationsModal}
          >
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl ring-1 ring-amber-100 transition group-hover:bg-white">
                  🔔
                </span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  الإشعارات
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  تابع آخر تحديثات مواعيدك الطبية.
                </span>
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showNotificationsModal ? '⌃' : '⌄'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 ring-1 ring-amber-100">
              {unreadNotificationsCount} غير مقروء
            </span>
          </button>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setShowDoctorsDirectory(true)}
            className={`group w-full overflow-hidden rounded-2xl border p-6 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
              showDoctorsDirectory
                ? 'border-teal-600 bg-teal-50'
                : 'border-teal-100 bg-gradient-to-br from-teal-50 via-white to-emerald-50 hover:border-teal-200'
            }`}
            aria-expanded={showDoctorsDirectory}
          >
            <span className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm ring-1 ring-teal-100">
                  👨‍⚕️
                </span>
                <span className="min-w-0">
                <span className="block text-2xl font-black tracking-normal text-slate-950">
                  الأطباء
                </span>
                <span className="mt-2 block text-sm leading-7 text-slate-600">
                  اختر التخصص وتعرّف على الأطباء المتاحين ومعلوماتهم المهنية.
                </span>
              </span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition group-hover:bg-teal-800">
                استعراض الأطباء
              </span>
            </span>
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-teal-700">اختيارات موثوقة</p>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
                الأطباء المتميزون
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                أطباء نشطون بتقييمات عالية وتجارب موثوقة من المرضى.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDoctorsDirectory(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-5 text-sm font-bold text-teal-800 transition hover:-translate-y-0.5 hover:bg-teal-100 hover:shadow-sm"
            >
              المزيد
            </button>
          </div>

          {loadingFeaturedDoctors ? (
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              جاري تحميل الأطباء المتميزين...
            </p>
          ) : featuredDoctors.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredDoctors.map((doctor) => (
                <article
                  key={doctor.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-50 text-lg font-black text-teal-800 ring-1 ring-teal-100">
                        {doctor.avatar_url ? (
                          <img
                            src={doctor.avatar_url}
                            alt={doctor.full_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getDoctorInitials(doctor.full_name)
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-slate-950">
                          {doctor.full_name}
                        </h3>
                        <p className="mt-1 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
                          {getSpecialtyMeta(doctor.specialty).labelAr}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {doctor.clinic_name ?? 'عيادة غير محددة'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="text-2xl leading-none text-slate-300 transition hover:text-rose-500"
                      aria-label="إضافة إلى المفضلة"
                    >
                      ♡
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm">
                    <p className="inline-flex w-fit rounded-xl bg-amber-50 px-3 py-2 font-bold text-amber-700 ring-1 ring-amber-100">
                      {doctor.reviews_count > 0 && doctor.average_rating != null
                        ? `⭐ ${doctor.average_rating.toFixed(1)} (${doctor.reviews_count} تقييم)`
                        : 'لا توجد تقييمات بعد'}
                    </p>
                    {doctor.years_experience != null ? (
                      <p className="text-slate-600">
                        خبرة {doctor.years_experience} سنة
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => handleToggleBookingForm(doctor.id)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md"
                      aria-expanded={activeBookingDoctorId === doctor.id}
                    >
                      {activeBookingDoctorId === doctor.id
                        ? 'إخفاء نموذج الحجز'
                        : 'حجز موعد'}
                    </button>

                    {activeBookingDoctorId === doctor.id ? (
                      <div className="mt-4 grid gap-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <label
                              className="text-sm font-bold text-slate-800"
                              htmlFor={`featured-booking-date-${doctor.id}`}
                            >
                              التاريخ
                            </label>
                            <input
                              id={`featured-booking-date-${doctor.id}`}
                              type="date"
                              value={bookingDate}
                              min={getTodayInputValue()}
                              onChange={(event) => setBookingDate(event.target.value)}
                              className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            {renderBookingSlotGrid()}
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <label
                            className="text-sm font-bold text-slate-800"
                            htmlFor={`featured-booking-notes-${doctor.id}`}
                          >
                            ملاحظات اختيارية
                          </label>
                          <textarea
                            id={`featured-booking-notes-${doctor.id}`}
                            value={bookingNotes}
                            onChange={(event) => setBookingNotes(event.target.value)}
                            rows={3}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                            placeholder="اكتب أي ملاحظات للطبيب"
                          />
                        </div>

                        {bookingError ? (
                          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                            {bookingError}
                          </p>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void handleConfirmBooking(doctor)}
                          disabled={
                            submittingBooking ||
                            loadingSlots ||
                            !bookingDate ||
                            !bookingTime
                          }
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submittingBooking
                            ? 'جاري تأكيد الحجز...'
                            : 'تأكيد الحجز'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              لا يوجد أطباء متميزون حالياً
            </p>
          )}
        </section>

        {showDoctorsDirectory ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctors-directory-modal-title"
            onClick={() => setShowDoctorsDirectory(false)}
          >
            <section
              className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-teal-700">الأطباء</p>
                  <h2
                    id="doctors-directory-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    {selectedSpecialty
                      ? `أطباء تخصص: ${getSpecialtyMeta(selectedSpecialty).labelAr}`
                      : 'اختيار التخصص'}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDoctorsDirectory(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  إغلاق
                </button>
              </div>
            {!selectedSpecialty ? (
              <div>
                <div>
                  <h2 className="text-xl font-bold tracking-normal text-slate-950">
                    اختر التخصص
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    ابدأ باختيار التخصص الطبي لعرض الأطباء المتاحين.
                  </p>
                </div>

                {doctorsDirectoryError ? (
                  <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                    {doctorsDirectoryError}
                  </p>
                ) : null}

                {MEDICAL_SPECIALTIES.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {MEDICAL_SPECIALTIES.map((specialty) => {
                      const meta = getSpecialtyMeta(specialty)

                      return (
                        <button
                          key={specialty}
                          type="button"
                          onClick={() => setSelectedSpecialty(specialty)}
                          className="group rounded-lg border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:shadow-md"
                        >
                          <span className="flex items-start gap-4">
                            <span
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-2xl ring-1 ring-teal-100 transition group-hover:bg-white"
                              aria-hidden="true"
                            >
                              {meta.icon}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-base font-bold text-slate-950">
                                {meta.labelAr}
                              </span>
                              <span className="mt-1 block text-xs font-semibold text-slate-500">
                                {specialty}
                              </span>
                              <span className="mt-2 block text-sm leading-6 text-slate-600">
                                عرض الأطباء المتاحين في هذا التخصص
                              </span>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                    لا توجد تخصصات متاحة حالياً
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-normal text-slate-950">
                      أطباء تخصص: {getSpecialtyMeta(selectedSpecialty).labelAr}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      استعرض معلومات الأطباء المهنية وتقييمات المرضى.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSpecialty('')}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    رجوع إلى التخصصات
                  </button>
                </div>

                {doctorsDirectoryError ? (
                  <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                    {doctorsDirectoryError}
                  </p>
                ) : null}

                {bookingSuccess ? (
                  <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
                    {bookingSuccess}
                  </p>
                ) : null}

                {loadingDoctors ? (
                  <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                    جاري تحميل الأطباء...
                  </p>
                ) : doctors.length > 0 ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {doctors.map((doctor) => (
                      <article
                        key={doctor.id}
                        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-xl font-bold text-teal-800 ring-1 ring-teal-100">
                            {doctor.avatar_url ? (
                              <img
                                src={doctor.avatar_url}
                                alt={doctor.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getDoctorInitials(doctor.full_name)
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold tracking-normal text-slate-950">
                              {doctor.full_name}
                            </h3>
                            <p className="mt-1 text-sm font-semibold text-teal-800">
                              {getSpecialtyMeta(doctor.specialty).labelAr}
                            </p>
                            {doctor.clinic_name ? (
                              <p className="mt-1 text-sm text-slate-600">
                                {doctor.clinic_name}
                              </p>
                            ) : null}

                            <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                              {doctor.reviewStats.reviewCount > 0 &&
                              doctor.reviewStats.averageRating != null
                                ? `⭐ ${doctor.reviewStats.averageRating.toFixed(1)} (${doctor.reviewStats.reviewCount} تقييم)`
                                : 'لا توجد تقييمات بعد'}
                            </p>

                            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="font-bold text-slate-600">
                                  سنوات الخبرة
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {doctor.years_experience != null
                                    ? `${doctor.years_experience} سنة`
                                    : 'غير متوفر'}
                                </dd>
                              </div>

                              <div>
                                <dt className="font-bold text-slate-600">
                                  كلية الطب
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {doctor.medical_school ?? 'غير متوفر'}
                                </dd>
                              </div>

                              <div>
                                <dt className="font-bold text-slate-600">
                                  سنة التخرج
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {doctor.graduation_year ?? 'غير متوفر'}
                                </dd>
                              </div>

                              <div>
                                <dt className="font-bold text-slate-600">اللغات</dt>
                                <dd className="mt-1 text-slate-950">
                                  {formatList(doctor.languages)}
                                </dd>
                              </div>

                              <div className="sm:col-span-2">
                                <dt className="font-bold text-slate-600">
                                  المستشفيات السابقة
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {formatList(doctor.previous_hospitals)}
                                </dd>
                              </div>

                              <div className="sm:col-span-2">
                                <dt className="font-bold text-slate-600">
                                  نبذة مهنية
                                </dt>
                                <dd className="mt-1 line-clamp-4 leading-7 text-slate-700">
                                  {doctor.biography ?? 'غير متوفر'}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>

                        <div className="mt-5 border-t border-slate-100 pt-5">
                          <button
                            type="button"
                            onClick={() => handleToggleBookingForm(doctor.id)}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
                            aria-expanded={activeBookingDoctorId === doctor.id}
                          >
                            {activeBookingDoctorId === doctor.id
                              ? 'إخفاء نموذج الحجز'
                              : 'حجز موعد'}
                          </button>

                          {activeBookingDoctorId === doctor.id ? (
                            <div className="mt-5 grid gap-4 rounded-lg border border-teal-100 bg-teal-50/60 p-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <label
                                    className="text-sm font-bold text-slate-800"
                                    htmlFor={`booking-date-${doctor.id}`}
                                  >
                                    التاريخ
                                  </label>
                                  <input
                                    id={`booking-date-${doctor.id}`}
                                    type="date"
                                    value={bookingDate}
                                    min={getTodayInputValue()}
                                    onChange={(event) =>
                                      setBookingDate(event.target.value)
                                    }
                                    className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  {renderBookingSlotGrid()}
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <label
                                  className="text-sm font-bold text-slate-800"
                                  htmlFor={`booking-notes-${doctor.id}`}
                                >
                                  ملاحظات اختيارية
                                </label>
                                <textarea
                                  id={`booking-notes-${doctor.id}`}
                                  value={bookingNotes}
                                  onChange={(event) =>
                                    setBookingNotes(event.target.value)
                                  }
                                  rows={3}
                                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                                  placeholder="اكتب أي ملاحظات للطبيب"
                                />
                              </div>

                              {bookingError ? (
                                <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                                  {bookingError}
                                </p>
                              ) : null}

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <button
                                  type="button"
                                  onClick={() => void handleConfirmBooking(doctor)}
                                  disabled={
                                    submittingBooking ||
                                    loadingSlots ||
                                    !bookingDate ||
                                    !bookingTime
                                  }
                                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {submittingBooking
                                    ? 'جاري تأكيد الحجز...'
                                    : 'تأكيد الحجز'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleBookingForm(doctor.id)}
                                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-5 border-t border-slate-100 pt-5">
                          <button
                            type="button"
                            onClick={() => void handleToggleReviews(doctor.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
                            aria-expanded={expandedReviewsDoctorId === doctor.id}
                          >
                            <span>
                              {expandedReviewsDoctorId === doctor.id
                                ? 'إخفاء التقييمات'
                                : 'عرض التقييمات'}
                            </span>
                            <span className="text-xs text-amber-800">
                              {doctor.reviewStats.reviewCount} تقييم
                            </span>
                          </button>

                          {expandedReviewsDoctorId === doctor.id ? (
                            <section className="mt-5 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h4 className="text-base font-bold text-slate-950">
                                  التقييمات
                                </h4>
                                <span className="text-sm font-semibold text-amber-700">
                                  {doctor.reviewStats.reviewCount} تقييم
                                </span>
                              </div>

                              {reviewsError ? (
                                <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                                  {reviewsError}
                                </p>
                              ) : null}

                              {loadingReviews && !doctorReviews[doctor.id] ? (
                                <p className="mt-4 rounded-lg bg-white/70 px-4 py-5 text-center text-sm font-semibold text-slate-600">
                                  جاري تحميل التقييمات...
                                </p>
                              ) : (doctorReviews[doctor.id] ?? []).length > 0 ? (
                                <div className="mt-4 grid gap-3">
                                  {(doctorReviews[doctor.id] ?? []).map((review) => (
                                    <article
                                      key={review.id}
                                      className="rounded-lg border border-amber-100 bg-white p-4"
                                    >
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                          <p className="font-bold text-slate-950">
                                            مريض
                                          </p>
                                          <p className="mt-1 text-sm font-bold text-amber-600">
                                            {'★'.repeat(review.rating)}
                                            <span className="text-slate-300">
                                              {'★'.repeat(5 - review.rating)}
                                            </span>
                                          </p>
                                        </div>
                                        <time className="text-sm text-slate-500">
                                          {reviewDateFormatter.format(
                                            new Date(review.created_at),
                                          )}
                                        </time>
                                      </div>

                                      <p className="mt-3 text-sm leading-7 text-slate-700">
                                        {review.comment?.trim() ||
                                          'لم يكتب المريض تعليقاً.'}
                                      </p>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-4 rounded-lg bg-white/70 px-4 py-5 text-center text-sm font-semibold text-slate-600">
                                  لا توجد تقييمات بعد
                                </p>
                              )}
                            </section>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                    لا يوجد أطباء في هذا التخصص حالياً
                  </p>
                )}
              </div>
            )}
            </section>
          </div>
        ) : null}

        {showMedicalRecordsModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="medical-records-modal-title"
            onClick={() => setShowMedicalRecordsModal(false)}
          >
            <section
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-teal-700">لوحة المريض</p>
                  <h2
                    id="medical-records-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    السجلات الطبية
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    استعرض ملخصات الزيارات والوصفات والتقارير الطبية.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMedicalRecordsModal(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    إغلاق
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMedicalRecordsModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                    aria-label="إغلاق"
                  >
                    ×
                  </button>
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                لا توجد سجلات طبية بعد
              </p>
            </section>
          </div>
        ) : null}

        {showNotificationsModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-modal-title"
            onClick={() => setShowNotificationsModal(false)}
          >
            <section
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-teal-700">لوحة المريض</p>
                  <h2
                    id="notifications-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    الإشعارات
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    تابع آخر تحديثات مواعيدك الطبية.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNotificationsModal(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    إغلاق
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNotificationsModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                    aria-label="إغلاق"
                  >
                    ×
                  </button>
                </div>
              </div>

              <NotificationsPanel onUnreadCountChange={setUnreadNotificationsCount} />
            </section>
          </div>
        ) : null}

        {showAppointmentsModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upcoming-appointments-modal-title"
            onClick={() => setShowAppointmentsModal(false)}
          >
            <section
              className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-teal-700">لوحة المريض</p>
                  <h2
                    id="upcoming-appointments-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    المواعيد القادمة
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    أقرب خمسة مواعيد مرتبة حسب التاريخ.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/patient/book-appointment')}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800"
                  >
                    حجز موعد جديد
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAppointmentsModal(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    إغلاق
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAppointmentsModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                    aria-label="إغلاق"
                  >
                    ×
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
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
                    <div className="bg-slate-50 p-3 font-bold text-slate-700">
                      تاريخ الموعد
                    </div>
                    <div className="bg-slate-50 p-3 font-bold text-slate-700">الحالة</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {upcomingAppointments.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="grid gap-3 bg-white p-4 text-sm md:grid-cols-4 md:gap-px md:p-0"
                      >
                        <div className="md:p-3">
                          <span className="block font-bold text-slate-500 md:hidden">
                            الطبيب
                          </span>
                          <span className="font-semibold text-slate-950">
                            {appointment.doctor_name}
                          </span>
                        </div>
                        <div className="md:p-3">
                          <span className="block font-bold text-slate-500 md:hidden">
                            التخصص
                          </span>
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
                          <span className="block font-bold text-slate-500 md:hidden">
                            الحالة
                          </span>
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
          </div>
        ) : null}
      </div>
    </main>
  )
}
