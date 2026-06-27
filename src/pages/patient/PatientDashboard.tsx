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
  getDoctorsByCityAndSpecialty,
  type FeaturedDoctor,
  type Doctor,
} from '../../services/doctors'
import { getUnreadNotificationsCount } from '../../services/notifications'
import {
  getPushNotificationStatus,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  type PushNotificationStatus,
} from '../../services/pushNotifications'
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
  formatLocalAppointmentDate,
  formatLocalAppointmentTime,
} from '../../utils/dateTime'

const reviewDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
})

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

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    scheduled: 'Ù…Ø¬Ø¯ÙˆÙ„',
    completed: 'Ù…ÙƒØªÙ…Ù„',
    cancelled: 'Ù…Ù„ØºÙŠ',
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
  items && items.length > 0 ? items.join('ØŒ ') : 'ØºÙŠØ± Ù…ØªÙˆÙØ±'

function getBookingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('appointments_no_double_booking_idx')
  ) {
    return 'Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¹Ø¯ Ù…Ø­Ø¬ÙˆØ² Ø¨Ø§Ù„ÙØ¹Ù„. ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± ÙˆÙ‚Øª Ø¢Ø®Ø±.'
  }

  if (
    normalizedMessage.includes('doctor is unavailable on this day') ||
    normalizedMessage.includes('unavailable on this day')
  ) {
    return 'Ø§Ù„Ø·Ø¨ÙŠØ¨ ØºÙŠØ± Ù…ØªØ§Ø­ ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ…. ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± ØªØ§Ø±ÙŠØ® Ø¢Ø®Ø±.'
  }

  if (
    normalizedMessage.includes('doctor_not_available') ||
    normalizedMessage.includes('working hours')
  ) {
    return 'Ø§Ù„Ø·Ø¨ÙŠØ¨ ØºÙŠØ± Ù…ØªØ§Ø­ ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙˆÙ‚Øª. ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± ÙˆÙ‚Øª Ø¢Ø®Ø±.'
  }

  return message || 'ØªØ¹Ø°Ø± Ø­Ø¬Ø² Ø§Ù„Ù…ÙˆØ¹Ø¯. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.'
}

export default function PatientDashboard() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(true)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false)
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false)
  const [showDoctorsDirectory, setShowDoctorsDirectory] = useState(false)
  const [selectedCity, setSelectedCity] = useState('')
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
  const [selectedDoctorDetails, setSelectedDoctorDetails] =
    useState<DoctorDirectoryItem | null>(null)
  const [doctorReviews, setDoctorReviews] = useState<Record<string, DoctorReview[]>>(
    {},
  )
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [pushStatus, setPushStatus] =
    useState<PushNotificationStatus>('disabled')
  const [isUpdatingPush, setIsUpdatingPush] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const selectedBookingSlot = daySlots.find((slot) => slot.slot_start === bookingTime)

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

    if (!selectedCity || !selectedSpecialty) {
      setDoctors([])

      return () => {
        isMounted = false
      }
    }

    const fetchDoctors = async () => {
      setLoadingDoctors(true)
      setDoctorsDirectoryError('')

      try {
        const specialtyDoctors = await getDoctorsByCityAndSpecialty(
          selectedCity,
          selectedSpecialty,
        )
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
              : 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.'
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
  }, [selectedCity, selectedSpecialty])

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
          setDaySlots(slots)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª Ø§Ù„Ù…ØªØ§Ø­Ø©. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.'
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
              : 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.'
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

  useEffect(() => {
    let isMounted = true

    const loadPushStatus = async () => {
      const status = await getPushNotificationStatus()

      if (isMounted) {
        setPushStatus(status)
      }
    }

    void loadPushStatus()

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

  const emailUsername = user?.email?.split('@')[0] ?? ''
  const patientDisplayName = profile?.full_name?.trim() || emailUsername || 'Ù…Ø±ÙŠØ¶'

  const handlePushNotifications = async () => {
    setIsUpdatingPush(true)
    setPushMessage('')

    try {
      if (pushStatus === 'enabled') {
        await unsubscribeUserFromPush()
        setPushStatus('disabled')
        setPushMessage('ØªÙ… Ø¥ÙŠÙ‚Ø§Ù Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù‡Ø§ØªÙ.')
        return
      }

      await subscribeUserToPush()
      setPushStatus('enabled')
      setPushMessage('ØªÙ… ØªÙØ¹ÙŠÙ„ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù‡Ø§ØªÙ Ø¨Ù†Ø¬Ø§Ø­.')
    } catch (error) {
      const status = await getPushNotificationStatus()
      setPushStatus(status)
      setPushMessage(
        status === 'denied'
          ? 'ØªÙ… Ø±ÙØ¶ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ù…Ù† Ø§Ù„Ù…ØªØµÙØ­. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø³Ù…Ø§Ø­ Ø¨Ù‡Ø§ Ù…Ù† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹.'
          : error instanceof Error
            ? error.message
            : 'ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù‡Ø§ØªÙ.',
      )
    } finally {
      setIsUpdatingPush(false)
    }
  }

  const handleSignOut = async () => {
    setShowProfileMenu(false)
    await signOut()
  }

  const openDoctorsDirectory = () => {
    setSelectedCity('')
    setSelectedSpecialty('')
    setDoctors([])
    setDoctorsDirectoryError('')
    setShowDoctorsDirectory(true)
  }

  const closeDoctorsDirectory = () => {
    setShowDoctorsDirectory(false)
    setSelectedCity('')
    setSelectedSpecialty('')
    setDoctors([])
    setDoctorsDirectoryError('')
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
          : 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.'
      setReviewsError(message)
    } finally {
      setLoadingReviews(false)
    }
  }

  const handleConfirmBooking = async (doctor: BookableDoctor) => {
    setBookingError('')
    setBookingSuccess('')

    if (!bookingDate || !bookingTime) {
      setBookingError('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„ÙˆÙ‚Øª Ø§Ù„Ù…ØªØ§Ø­.')
      return
    }

    if (!selectedBookingSlot || selectedBookingSlot.status !== 'available') {
      setBookingError('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± ÙˆÙ‚Øª Ù…ØªØ§Ø­.')
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
        appointment_date: buildAppointmentDateTime(sqlDate, selectedTime),
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
      setBookingSuccess('ØªÙ… Ø­Ø¬Ø² Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø¨Ù†Ø¬Ø§Ø­')
    } catch (error) {
      setBookingError(getBookingErrorMessage(error))
    } finally {
      setSubmittingBooking(false)
    }
  }

  const renderBookingSlotGrid = () => (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold text-slate-800">Ø§Ù„ÙˆÙ‚Øª Ø§Ù„Ù…ØªØ§Ø­</span>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600">
          <span>ðŸŸ¢ Ù…ØªØ§Ø­</span>
          <span>ðŸ”´ Ù…Ø­Ø¬ÙˆØ²</span>
        </div>
      </div>

      {!bookingDate ? (
        <p className="rounded-lg bg-white/70 px-4 py-4 text-sm font-semibold text-slate-600">
          Ø§Ø®ØªØ± Ø§Ù„ØªØ§Ø±ÙŠØ® Ø£ÙˆÙ„Ø§Ù‹
        </p>
      ) : loadingSlots ? (
        <p className="rounded-lg bg-white/70 px-4 py-4 text-sm font-semibold text-slate-600">
          Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª...
        </p>
      ) : daySlots.length > 0 ? (
        <div className="grid gap-3">
          {daySlots.every((slot) => slot.status === 'booked') ? (
            <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª Ù…Ø­Ø¬ÙˆØ²Ø© ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ…
            </p>
          ) : null}

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
        </div>
      ) : (
        <p className="rounded-lg bg-white/70 px-4 py-4 text-sm font-semibold text-slate-600">
          Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ÙˆÙ‚Ø§Øª Ø¹Ù…Ù„ ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ… Ø£Ùˆ Ø§Ù„Ø·Ø¨ÙŠØ¨ ØºÙŠØ± Ù…ØªØ§Ø­
        </p>
      )}
    </div>
  )

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        <section className="relative overflow-visible rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm sm:p-8">
          <div className="absolute left-4 top-4 z-30">
            <button
              type="button"
              onClick={() => setShowProfileMenu((currentValue) => !currentValue)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(15,118,110,0.08)] text-2xl font-black leading-none text-[#0f766e] shadow-sm transition hover:bg-[rgba(15,118,110,0.15)] focus:outline-none focus:ring-2 focus:ring-teal-100"
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              aria-label="Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"
            >
              â˜°
            </button>

            <div
              className={`absolute left-0 mt-3 w-56 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 text-right text-slate-700 shadow-xl transition-all duration-200 ${
                showProfileMenu
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
              }`}
              role="menu"
            >
              <button
                type="button"
                onClick={() => setShowProfileMenu(false)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition hover:bg-teal-50 hover:text-teal-800"
                role="menuitem"
              >
                <span aria-hidden="true">ðŸ‘¤</span>
                Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ
              </button>
              <button
                type="button"
                onClick={() => setShowProfileMenu(false)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition hover:bg-teal-50 hover:text-teal-800"
                role="menuitem"
              >
                <span aria-hidden="true">âš™ï¸</span>
                Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={authLoading}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                role="menuitem"
              >
                <span aria-hidden="true">ðŸšª</span>
                ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-8 lg:flex-row lg:items-center lg:justify-between lg:pt-0">
            <div className="flex min-w-0 items-start gap-4 sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl font-black text-teal-700 shadow-sm ring-1 ring-teal-100 sm:h-20 sm:w-20 sm:rounded-3xl sm:text-3xl">
                {patientDisplayName.slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-teal-700 sm:text-sm">Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ</p>
                <h1 className="mt-1 truncate text-2xl font-black tracking-normal sm:mt-2 sm:text-4xl">
                  {patientDisplayName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-8">
                  Ù„Ø¯ÙŠÙƒ {upcomingAppointments.length} Ù…ÙˆØ¹Ø¯Ø§Ù‹ Ù‚Ø§Ø¯Ù…Ø§Ù‹ Ùˆ{' '}
                  {unreadNotificationsCount} Ø¥Ø´Ø¹Ø§Ø±Ø§Ù‹ ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡Ø§Ù‹
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              icon: 'âž•',
              label: 'Ø­Ø¬Ø² Ù…ÙˆØ¹Ø¯ Ø¬Ø¯ÙŠØ¯',
              onClick: () => navigate('/patient/book-appointment'),
              className:
                'border-slate-200 bg-white text-teal-700 hover:border-teal-200 hover:bg-teal-50',
            },
            {
              icon: 'ðŸ“…',
              label: 'Ù…ÙˆØ§Ø¹ÙŠØ¯ÙŠ',
              onClick: () => navigate('/patient/appointments'),
              className:
                'border-slate-200 bg-white text-blue-700 hover:border-blue-200 hover:bg-blue-50',
            },
            {
              icon: 'ðŸ””',
              label: 'Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª',
              onClick: () => setShowNotificationsModal(true),
              className:
                'border-slate-200 bg-white text-amber-700 hover:border-amber-200 hover:bg-amber-50',
            },
            {
              icon: 'ðŸ“„',
              label: 'Ø§Ù„Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ø·Ø¨ÙŠØ©',
              onClick: () => setShowMedicalRecordsModal(true),
              className:
                'border-slate-200 bg-white text-violet-700 hover:border-violet-200 hover:bg-violet-50',
            },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${action.className}`}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl"
              aria-hidden="true"
            >
              🔔
            </span>
            <div>
              <h2 className="text-base font-black text-slate-950">
                إشعارات الهاتف
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                استقبل تأكيدات المواعيد مباشرة على هاتفك أو متصفحك.
              </p>
              <p
                className={`mt-2 text-xs font-black ${
                  pushStatus === 'enabled'
                    ? 'text-emerald-700'
                    : pushStatus === 'denied'
                      ? 'text-rose-700'
                      : 'text-slate-500'
                }`}
              >
                الحالة:{' '}
                {pushStatus === 'enabled'
                  ? 'مفعلة'
                  : pushStatus === 'denied'
                    ? 'مرفوضة من المتصفح'
                    : pushStatus === 'unsupported'
                      ? 'غير مدعومة'
                      : 'غير مفعلة'}
              </p>
              {pushMessage ? (
                <p className="mt-2 text-xs font-bold text-slate-600" role="status">
                  {pushMessage}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handlePushNotifications}
            disabled={
              isUpdatingPush ||
              pushStatus === 'denied' ||
              pushStatus === 'unsupported'
            }
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
              pushStatus === 'enabled'
                ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-teal-700 text-white shadow-sm hover:bg-teal-800'
            }`}
          >
            {isUpdatingPush
              ? 'جاري التحديث...'
              : pushStatus === 'enabled'
                ? 'إيقاف إشعارات الهاتف'
                : 'تفعيل إشعارات الهاتف'}
          </button>
        </section>

        <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
                <span aria-hidden="true">ðŸ”Ž</span>
                <span>Ø§Ø¨Ø­Ø« Ø¹Ù† Ø·Ø¨ÙŠØ¨</span>
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© ÙˆØ§Ù„ØªØ®ØµØµ Ø«Ù… Ø§Ø³ØªØ¹Ø±Ø¶ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ†
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                {'\u0627\u0628\u062F\u0623 \u0628\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u062B\u0645 \u0627\u0644\u062A\u062E\u0635\u0635 \u0644\u0639\u0631\u0636 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u064A\u0646 \u0648\u0627\u0644\u062D\u062C\u0632 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0637\u0628\u064A\u0628.'}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="grid gap-2">
                <label className="text-sm font-bold text-slate-800" htmlFor="dashboard-search-city">
                  {'\u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
                </label>
                <select
                  id="dashboard-search-city"
                  value={selectedCity}
                  onChange={(event) => {
                    setSelectedCity(event.target.value)
                    setSelectedSpecialty('')
                    setDoctors([])
                    setDoctorsDirectoryError('')
                  }}
                  className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
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
                <label className="text-sm font-bold text-slate-800" htmlFor="dashboard-search-specialty">
                  {'\u0627\u0644\u062A\u062E\u0635\u0635'}
                </label>
                <select
                  id="dashboard-search-specialty"
                  value={selectedSpecialty}
                  onChange={(event) => {
                    setSelectedSpecialty(event.target.value)
                    setDoctorsDirectoryError('')
                  }}
                  disabled={!selectedCity}
                  className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">
                    {selectedCity
                      ? '\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u062E\u0635\u0635'
                      : '\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0623\u0648\u0644\u0627\u064B'}
                  </option>
                  {MEDICAL_SPECIALTIES.map((specialty) => {
                    const meta = getSpecialtyMeta(specialty)

                    return (
                      <option key={specialty} value={specialty}>
                        {meta.icon} {meta.labelAr}
                      </option>
                    )
                  })}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDoctorsDirectoryError('')
                  setShowDoctorsDirectory(true)
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-700 px-6 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md"
              >
                {'\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0627\u0644\u0623\u0637\u0628\u0627\u0621'}
              </button>
            </div>
          </div>
        </section>

        {bookingSuccess ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
            {bookingSuccess}
          </p>
        ) : null}

        <section className="hidden grid gap-4 md:grid-cols-3">
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
                  ðŸ“…
                </span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  Ø±Ø§Ø¬Ø¹ Ù…ÙˆØ§Ø¹ÙŠØ¯Ùƒ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø© ÙˆØ­Ø§Ù„Ø§ØªÙ‡Ø§.
                </span>
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showAppointmentsModal ? 'âŒƒ' : 'âŒ„'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-xl bg-teal-50 px-4 py-2 text-sm font-black text-teal-800 ring-1 ring-teal-100">
              {isFetchingAppointments
                ? 'Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...'
                : `${upcomingAppointments.length} Ù…ÙˆØ¹Ø¯`}
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
                  ðŸ“„
                </span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  Ø§Ù„Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ø·Ø¨ÙŠØ©
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  Ø§Ø³ØªØ¹Ø±Ø¶ Ù…Ù„Ø®ØµØ§Øª Ø§Ù„Ø²ÙŠØ§Ø±Ø§Øª ÙˆØ§Ù„ÙˆØµÙØ§Øª ÙˆØ§Ù„ØªÙ‚Ø§Ø±ÙŠØ± Ø§Ù„Ø·Ø¨ÙŠØ©.
                </span>
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showMedicalRecordsModal ? 'âŒƒ' : 'âŒ„'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
              Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³Ø¬Ù„Ø§Øª Ø¬Ø¯ÙŠØ¯Ø©
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
                  ðŸ””
                </span>
                <span className="block text-lg font-bold tracking-normal text-slate-950">
                  Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª
                </span>
                <span className="mt-3 block text-sm leading-7 text-slate-600">
                  ØªØ§Ø¨Ø¹ Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«Ø§Øª Ù…ÙˆØ§Ø¹ÙŠØ¯Ùƒ Ø§Ù„Ø·Ø¨ÙŠØ©.
                </span>
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                {showNotificationsModal ? 'âŒƒ' : 'âŒ„'}
              </span>
            </span>
            <span className="mt-6 inline-flex rounded-xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 ring-1 ring-amber-100">
              {unreadNotificationsCount} ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡
            </span>
          </button>
        </section>

        <section className="hidden">
          <button
            type="button"
            onClick={openDoctorsDirectory}
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
                  ðŸ‘¨â€âš•ï¸
                </span>
                <span className="min-w-0">
                <span className="block text-2xl font-black tracking-normal text-slate-950">
                  Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡
                </span>
                <span className="mt-2 block text-sm leading-7 text-slate-600">
                  Ø§Ø®ØªØ± Ø§Ù„ØªØ®ØµØµ ÙˆØªØ¹Ø±Ù‘Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ† ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙ‡Ù… Ø§Ù„Ù…Ù‡Ù†ÙŠØ©.
                </span>
              </span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition group-hover:bg-teal-800">
                Ø§Ø³ØªØ¹Ø±Ø§Ø¶ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡
              </span>
            </span>
          </button>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                <span aria-hidden="true">â­</span>
                <span>Ø£Ø·Ø¨Ø§Ø¡ Ù…ÙˆØ«ÙˆÙ‚ÙˆÙ†</span>
              </span>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-slate-950">
                Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªÙ…ÙŠØ²ÙˆÙ†
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Ø£Ø·Ø¨Ø§Ø¡ Ø­ØµÙ„ÙˆØ§ Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø¬ÙŠØ¯Ø© ÙˆØªØ¬Ø§Ø±Ø¨ Ù…ÙˆØ«ÙˆÙ‚Ø© Ù…Ù† Ø§Ù„Ù…Ø±Ø¶Ù‰.
              </p>
            </div>

            <button
              type="button"
              onClick={openDoctorsDirectory}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-5 text-sm font-bold text-teal-800 transition hover:-translate-y-0.5 hover:bg-teal-100 hover:shadow-sm"
            >
              Ø§Ù„Ù…Ø²ÙŠØ¯
            </button>
          </div>

          {loadingFeaturedDoctors ? (
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªÙ…ÙŠØ²ÙŠÙ†...
            </p>
          ) : featuredDoctors.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredDoctors.map((doctor) => (
                <article
                  key={doctor.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl"
                >
                  <div className="relative rounded-3xl bg-gradient-to-br from-teal-50 to-white p-5 ring-1 ring-teal-100">
                    <div className="flex min-w-0 flex-col items-center text-center">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white text-2xl font-black text-teal-800 shadow-md ring-4 ring-white">
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

                      <div className="mt-4 min-w-0">
                        <h3 className="truncate text-xl font-black text-slate-950">
                          {doctor.full_name}
                        </h3>
                        <p className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-xs font-black text-white shadow-sm">
                          <span>{getSpecialtyMeta(doctor.specialty).icon}</span>
                          {getSpecialtyMeta(doctor.specialty).labelAr}
                        </p>
                        <p className="sr-only">
                          {doctor.clinic_name ?? 'Ø¹ÙŠØ§Ø¯Ø© ØºÙŠØ± Ù…Ø­Ø¯Ø¯Ø©'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="absolute left-4 top-4 text-2xl leading-none text-slate-300 transition hover:scale-110 hover:text-rose-500"
                      aria-label="Ø¥Ø¶Ø§ÙØ© Ø¥Ù„Ù‰ Ø§Ù„Ù…ÙØ¶Ù„Ø©"
                    >
                      â™¡
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm">
                    <p className="inline-flex w-fit items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 font-black text-amber-700 ring-1 ring-amber-100">
                      {doctor.reviews_count > 0 && doctor.average_rating != null
                        ? `â­ ${doctor.average_rating.toFixed(1)} (${doctor.reviews_count} ØªÙ‚ÙŠÙŠÙ…)`
                        : 'Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø¨Ø¹Ø¯'}
                    </p>
                    {doctor.city ? (
                      <p className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-700">
                        <span aria-hidden="true">{'\uD83D\uDCCD'}</span>
                        <span>{doctor.city}</span>
                      </p>
                    ) : null}
                    {doctor.address || doctor.clinic_name ? (
                      <p className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 font-semibold leading-7 text-slate-700">
                        <span aria-hidden="true">{'\uD83C\uDFE5'}</span>
                        <span>{doctor.address ?? doctor.clinic_name}</span>
                      </p>
                    ) : null}
                    {doctor.years_experience != null ? (
                      <p className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-700 before:content-['ðŸ©º']">
                        Ø®Ø¨Ø±Ø© {doctor.years_experience} Ø³Ù†Ø©
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleToggleBookingForm(doctor.id)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md"
                      aria-expanded={activeBookingDoctorId === doctor.id}
                    >
                      {activeBookingDoctorId === doctor.id
                        ? 'Ø¥Ø®ÙØ§Ø¡ Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø­Ø¬Ø²'
                        : 'Ø­Ø¬Ø² Ù…ÙˆØ¹Ø¯'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleToggleReviews(doctor.id)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-5 text-sm font-bold text-amber-700 transition hover:-translate-y-0.5 hover:bg-amber-100 hover:shadow-sm"
                      aria-expanded={expandedReviewsDoctorId === doctor.id}
                    >
                      {expandedReviewsDoctorId === doctor.id
                        ? '\u0625\u062E\u0641\u0627\u0621 \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A'
                        : '\u0639\u0631\u0636 \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A'}
                    </button>

                    {activeBookingDoctorId === doctor.id ? (
                      <div className="mt-4 grid gap-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 sm:col-span-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <label
                              className="text-sm font-bold text-slate-800"
                              htmlFor={`featured-booking-date-${doctor.id}`}
                            >
                              Ø§Ù„ØªØ§Ø±ÙŠØ®
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
                            Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ø®ØªÙŠØ§Ø±ÙŠØ©
                          </label>
                          <textarea
                            id={`featured-booking-notes-${doctor.id}`}
                            value={bookingNotes}
                            onChange={(event) => setBookingNotes(event.target.value)}
                            rows={3}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                            placeholder="Ø§ÙƒØªØ¨ Ø£ÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ù„Ù„Ø·Ø¨ÙŠØ¨"
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
                            ? 'Ø¬Ø§Ø±ÙŠ ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø¬Ø²...'
                            : 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø¬Ø²'}
                        </button>
                      </div>
                    ) : null}

                    {expandedReviewsDoctorId === doctor.id ? (
                      <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:col-span-2">
                        {reviewsError ? (
                          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                            {reviewsError}
                          </p>
                        ) : null}

                        {loadingReviews && !doctorReviews[doctor.id] ? (
                          <p className="rounded-xl bg-white/80 px-4 py-5 text-center text-sm font-semibold text-slate-600">
                            {'\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A...'}
                          </p>
                        ) : (doctorReviews[doctor.id] ?? []).length > 0 ? (
                          <div className="grid gap-3">
                            {(doctorReviews[doctor.id] ?? []).slice(0, 3).map((review) => (
                              <article
                                key={review.id}
                                className="rounded-xl border border-amber-100 bg-white p-3"
                              >
                                <p className="text-sm font-bold text-amber-600">
                                  {'\u2605'.repeat(review.rating)}
                                  <span className="text-slate-300">
                                    {'\u2605'.repeat(5 - review.rating)}
                                  </span>
                                </p>
                                <p className="mt-2 text-sm leading-7 text-slate-700">
                                  {review.comment?.trim() ||
                                    '\u0644\u0645 \u064A\u0643\u062A\u0628 \u0627\u0644\u0645\u0631\u064A\u0636 \u062A\u0639\u0644\u064A\u0642\u0627\u064B.'}
                                </p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-white/80 px-4 py-5 text-center text-sm font-semibold text-slate-600">
                            {'\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0628\u0639\u062F'}
                          </p>
                        )}
                      </section>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">
              Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø£Ø·Ø¨Ø§Ø¡ Ù…ØªÙ…ÙŠØ²ÙˆÙ† Ø­Ø§Ù„ÙŠØ§Ù‹
            </p>
          )}
        </section>

        {showDoctorsDirectory ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctors-directory-modal-title"
            onClick={closeDoctorsDirectory}
          >
            <section
              className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute left-5 top-5 flex items-center gap-2" dir="ltr">
                {selectedSpecialty ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSpecialty('')}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-slate-600 shadow-sm transition hover:bg-slate-200"
                    aria-label="Ø±Ø¬ÙˆØ¹ Ø¥Ù„Ù‰ Ø§Ù„ØªØ®ØµØµØ§Øª"
                  >
                    â†
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeDoctorsDirectory}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-slate-600 shadow-sm transition hover:bg-slate-200"
                  aria-label="Ø¥ØºÙ„Ø§Ù‚"
                >
                  Ã—
                </button>
              </div>

              <div className="mb-4 pl-24">
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-700">
                    Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡
                  </span>
                  <h2
                    id="doctors-directory-modal-title"
                    className="mt-3 text-2xl font-black tracking-normal text-slate-950"
                  >
                    {selectedSpecialty
                      ? `\u0623\u0637\u0628\u0627\u0621 \u062A\u062E\u0635\u0635: ${getSpecialtyMeta(selectedSpecialty).labelAr}`
                      : selectedCity
                        ? '\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u062A\u062E\u0635\u0635'
                        : '\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {selectedSpecialty
                      ? 'Ø§Ø³ØªØ¹Ø±Ø¶ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…Ù‡Ù†ÙŠØ© ÙˆØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø§Ù„Ù…Ø±Ø¶Ù‰.'
                      : selectedCity
                        ? 'Ø§Ø¨Ø¯Ø£ Ø¨Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„ØªØ®ØµØµ Ø§Ù„Ø·Ø¨ÙŠ Ù„Ø¹Ø±Ø¶ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ†.'
                        : 'Ø§Ø¨Ø¯Ø£ Ø¨Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ù„Ø¹Ø±Ø¶ Ø§Ù„ØªØ®ØµØµØ§Øª ÙˆØ§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ†.'}
                  </p>
                </div>
              </div>
            {!selectedCity ? (
              <div>
                <div>
                  <h2 className="text-xl font-bold tracking-normal text-slate-950">
                    {'\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {'\u0627\u0628\u062F\u0623 \u0628\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u062E\u0635\u0635\u0627\u062A \u0648\u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0627\u0644\u0645\u062A\u0627\u062D\u064A\u0646.'}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {MOROCCAN_CITIES.map((cityOption) => (
                    <button
                      key={cityOption}
                      type="button"
                      onClick={() => {
                        setSelectedCity(cityOption)
                        setSelectedSpecialty('')
                        setDoctors([])
                      }}
                      className="group rounded-lg border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:shadow-md"
                    >
                      <span className="flex items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-2xl ring-1 ring-teal-100 transition group-hover:bg-white">
                          {'\uD83D\uDCCD'}
                        </span>
                        <span className="text-base font-bold text-slate-950">
                          {cityOption}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : !selectedSpecialty ? (
              <div>
                <div>
                  <h2 className="text-xl font-bold tracking-normal text-slate-950">
                    Ø§Ø®ØªØ± Ø§Ù„ØªØ®ØµØµ
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Ø§Ø¨Ø¯Ø£ Ø¨Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„ØªØ®ØµØµ Ø§Ù„Ø·Ø¨ÙŠ Ù„Ø¹Ø±Ø¶ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ†.
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
                                Ø¹Ø±Ø¶ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ† ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ØªØ®ØµØµ
                              </span>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                    Ù„Ø§ ØªÙˆØ¬Ø¯ ØªØ®ØµØµØ§Øª Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹
                  </p>
                )}
              </div>
            ) : (
              <div>
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
                    Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø£Ø·Ø¨Ø§Ø¡...
                  </p>
                ) : doctors.length > 0 ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {doctors.map((doctor) => (
                      <article
                        key={doctor.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:rounded-lg md:p-5"
                      >
                        <div className="flex gap-4 md:items-start">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-50 text-xl font-bold text-teal-800 ring-1 ring-teal-100 md:rounded-full">
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
                            <h3 className="truncate text-base font-bold tracking-normal text-slate-950 md:text-lg">
                              {doctor.full_name}
                            </h3>
                            <p className="mt-1 text-sm font-semibold text-teal-800">
                              {getSpecialtyMeta(doctor.specialty).labelAr}
                            </p>
                            {doctor.clinic_name ? (
                              <p className="mt-1 hidden text-sm text-slate-600 md:block">
                                {doctor.clinic_name}
                              </p>
                            ) : null}
                            {doctor.city ? (
                              <p className="mt-2 text-sm font-semibold text-slate-600">
                                {'\uD83D\uDCCD '}
                                {doctor.city}
                              </p>
                            ) : null}
                            {doctor.address ? (
                              <p className="mt-2 hidden text-sm font-semibold text-slate-600 md:block">
                                {'\uD83C\uDFE5 '}
                                {doctor.address}
                              </p>
                            ) : null}

                            <p className="mt-2 inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 md:mt-3 md:px-3 md:py-2 md:text-sm">
                              {doctor.reviewStats.reviewCount > 0 &&
                              doctor.reviewStats.averageRating != null
                                ? `â­ ${doctor.reviewStats.averageRating.toFixed(1)} (${doctor.reviewStats.reviewCount} ØªÙ‚ÙŠÙŠÙ…)`
                                : 'Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø¨Ø¹Ø¯'}
                            </p>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row md:hidden">
                              <button
                                type="button"
                                onClick={() => setSelectedDoctorDetails(doctor)}
                                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                Ø¹Ø±Ø¶ Ø§Ù„ØªÙØ§ØµÙŠÙ„
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleBookingForm(doctor.id)}
                                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-teal-700 px-3 text-sm font-bold text-white transition hover:bg-teal-800"
                                aria-expanded={activeBookingDoctorId === doctor.id}
                              >
                                Ø­Ø¬Ø² Ù…ÙˆØ¹Ø¯
                              </button>
                            </div>

                            <dl className="mt-4 hidden gap-3 text-sm md:grid md:grid-cols-2">
                              <div>
                                <dt className="font-bold text-slate-600">
                                  Ø³Ù†ÙˆØ§Øª Ø§Ù„Ø®Ø¨Ø±Ø©
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {doctor.years_experience != null
                                    ? `${doctor.years_experience} Ø³Ù†Ø©`
                                    : 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                                </dd>
                              </div>

                              <div>
                                <dt className="font-bold text-slate-600">
                                  ÙƒÙ„ÙŠØ© Ø§Ù„Ø·Ø¨
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {doctor.medical_school ?? 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                                </dd>
                              </div>

                              <div>
                                <dt className="font-bold text-slate-600">
                                  Ø³Ù†Ø© Ø§Ù„ØªØ®Ø±Ø¬
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {doctor.graduation_year ?? 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                                </dd>
                              </div>

                              <div>
                                <dt className="font-bold text-slate-600">Ø§Ù„Ù„ØºØ§Øª</dt>
                                <dd className="mt-1 text-slate-950">
                                  {formatList(doctor.languages)}
                                </dd>
                              </div>

                              <div className="sm:col-span-2">
                                <dt className="font-bold text-slate-600">
                                  Ø§Ù„Ù…Ø³ØªØ´ÙÙŠØ§Øª Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©
                                </dt>
                                <dd className="mt-1 text-slate-950">
                                  {formatList(doctor.previous_hospitals)}
                                </dd>
                              </div>

                              <div className="sm:col-span-2">
                                <dt className="font-bold text-slate-600">
                                  Ù†Ø¨Ø°Ø© Ù…Ù‡Ù†ÙŠØ©
                                </dt>
                                <dd className="mt-1 line-clamp-4 leading-7 text-slate-700">
                                  {doctor.biography ?? 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>

                        <div className="mt-4 md:mt-5 md:border-t md:border-slate-100 md:pt-5">
                          <button
                            type="button"
                            onClick={() => handleToggleBookingForm(doctor.id)}
                            className="hidden min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 md:inline-flex"
                            aria-expanded={activeBookingDoctorId === doctor.id}
                          >
                            {activeBookingDoctorId === doctor.id
                              ? 'Ø¥Ø®ÙØ§Ø¡ Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø­Ø¬Ø²'
                              : 'Ø­Ø¬Ø² Ù…ÙˆØ¹Ø¯'}
                          </button>

                          {activeBookingDoctorId === doctor.id ? (
                            <div className="mt-5 grid gap-4 rounded-lg border border-teal-100 bg-teal-50/60 p-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <label
                                    className="text-sm font-bold text-slate-800"
                                    htmlFor={`booking-date-${doctor.id}`}
                                  >
                                    Ø§Ù„ØªØ§Ø±ÙŠØ®
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
                                  Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ø®ØªÙŠØ§Ø±ÙŠØ©
                                </label>
                                <textarea
                                  id={`booking-notes-${doctor.id}`}
                                  value={bookingNotes}
                                  onChange={(event) =>
                                    setBookingNotes(event.target.value)
                                  }
                                  rows={3}
                                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
                                  placeholder="Ø§ÙƒØªØ¨ Ø£ÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ù„Ù„Ø·Ø¨ÙŠØ¨"
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
                                    ? 'Ø¬Ø§Ø±ÙŠ ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø¬Ø²...'
                                    : 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø¬Ø²'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleBookingForm(doctor.id)}
                                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Ø¥Ù„ØºØ§Ø¡
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-5 hidden border-t border-slate-100 pt-5 md:block">
                          <button
                            type="button"
                            onClick={() => void handleToggleReviews(doctor.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
                            aria-expanded={expandedReviewsDoctorId === doctor.id}
                          >
                            <span>
                              {expandedReviewsDoctorId === doctor.id
                                ? 'Ø¥Ø®ÙØ§Ø¡ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª'
                                : 'Ø¹Ø±Ø¶ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª'}
                            </span>
                            <span className="text-xs text-amber-800">
                              {doctor.reviewStats.reviewCount} ØªÙ‚ÙŠÙŠÙ…
                            </span>
                          </button>

                          {expandedReviewsDoctorId === doctor.id ? (
                            <section className="mt-5 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h4 className="text-base font-bold text-slate-950">
                                  Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª
                                </h4>
                                <span className="text-sm font-semibold text-amber-700">
                                  {doctor.reviewStats.reviewCount} ØªÙ‚ÙŠÙŠÙ…
                                </span>
                              </div>

                              {reviewsError ? (
                                <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                                  {reviewsError}
                                </p>
                              ) : null}

                              {loadingReviews && !doctorReviews[doctor.id] ? (
                                <p className="mt-4 rounded-lg bg-white/70 px-4 py-5 text-center text-sm font-semibold text-slate-600">
                                  Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª...
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
                                            Ù…Ø±ÙŠØ¶
                                          </p>
                                          <p className="mt-1 text-sm font-bold text-amber-600">
                                            {'â˜…'.repeat(review.rating)}
                                            <span className="text-slate-300">
                                              {'â˜…'.repeat(5 - review.rating)}
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
                                          'Ù„Ù… ÙŠÙƒØªØ¨ Ø§Ù„Ù…Ø±ÙŠØ¶ ØªØ¹Ù„ÙŠÙ‚Ø§Ù‹.'}
                                      </p>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-4 rounded-lg bg-white/70 px-4 py-5 text-center text-sm font-semibold text-slate-600">
                                  Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø¨Ø¹Ø¯
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
                    Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø£Ø·Ø¨Ø§Ø¡ ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ØªØ®ØµØµ Ø¯Ø§Ø®Ù„ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø­Ø§Ù„ÙŠØ§Ù‹
                  </p>
                )}
              </div>
            )}
            </section>
          </div>
        ) : null}

        {selectedDoctorDetails ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-slate-950/50 px-4 pb-4 pt-16 md:items-center md:justify-center md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctor-details-title"
          >
            <section className="max-h-[86vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl md:max-w-2xl md:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-teal-700">
                    {getSpecialtyMeta(selectedDoctorDetails.specialty).labelAr}
                  </p>
                  <h2
                    id="doctor-details-title"
                    className="mt-1 truncate text-2xl font-black tracking-normal text-slate-950"
                  >
                    {selectedDoctorDetails.full_name}
                  </h2>
                  <p className="mt-2 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                    {selectedDoctorDetails.reviewStats.reviewCount > 0 &&
                    selectedDoctorDetails.reviewStats.averageRating != null
                      ? `â­ ${selectedDoctorDetails.reviewStats.averageRating.toFixed(
                          1,
                        )} (${selectedDoctorDetails.reviewStats.reviewCount} ØªÙ‚ÙŠÙŠÙ…)`
                      : 'Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø¨Ø¹Ø¯'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDoctorDetails(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                  aria-label="Ø¥ØºÙ„Ø§Ù‚ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø·Ø¨ÙŠØ¨"
                >
                  Ã—
                </button>
              </div>

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-slate-600">Ø³Ù†ÙˆØ§Øª Ø§Ù„Ø®Ø¨Ø±Ø©</dt>
                  <dd className="mt-1 text-slate-950">
                    {selectedDoctorDetails.years_experience != null
                      ? `${selectedDoctorDetails.years_experience} Ø³Ù†Ø©`
                      : 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                  </dd>
                </div>

                <div>
                  <dt className="font-bold text-slate-600">ÙƒÙ„ÙŠØ© Ø§Ù„Ø·Ø¨</dt>
                  <dd className="mt-1 text-slate-950">
                    {selectedDoctorDetails.medical_school ?? 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                  </dd>
                </div>

                <div>
                  <dt className="font-bold text-slate-600">Ø³Ù†Ø© Ø§Ù„ØªØ®Ø±Ø¬</dt>
                  <dd className="mt-1 text-slate-950">
                    {selectedDoctorDetails.graduation_year ?? 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                  </dd>
                </div>

                <div>
                  <dt className="font-bold text-slate-600">Ø§Ù„Ù„ØºØ§Øª</dt>
                  <dd className="mt-1 text-slate-950">
                    {formatList(selectedDoctorDetails.languages)}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="font-bold text-slate-600">Ø§Ù„Ù…Ø³ØªØ´ÙÙŠØ§Øª Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©</dt>
                  <dd className="mt-1 text-slate-950">
                    {formatList(selectedDoctorDetails.previous_hospitals)}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="font-bold text-slate-600">Ù†Ø¨Ø°Ø© Ù…Ù‡Ù†ÙŠØ©</dt>
                  <dd className="mt-1 leading-7 text-slate-700">
                    {selectedDoctorDetails.biography ?? 'ØºÙŠØ± Ù…ØªÙˆÙØ±'}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleBookingForm(selectedDoctorDetails.id)
                    setSelectedDoctorDetails(null)
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
                >
                  Ø­Ø¬Ø² Ù…ÙˆØ¹Ø¯
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDoctorDetails(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Ø¥ØºÙ„Ø§Ù‚
                </button>
              </div>
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
                  <p className="text-sm font-bold text-teal-700">Ù„ÙˆØ­Ø© Ø§Ù„Ù…Ø±ÙŠØ¶</p>
                  <h2
                    id="medical-records-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    Ø§Ù„Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ø·Ø¨ÙŠØ©
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Ø§Ø³ØªØ¹Ø±Ø¶ Ù…Ù„Ø®ØµØ§Øª Ø§Ù„Ø²ÙŠØ§Ø±Ø§Øª ÙˆØ§Ù„ÙˆØµÙØ§Øª ÙˆØ§Ù„ØªÙ‚Ø§Ø±ÙŠØ± Ø§Ù„Ø·Ø¨ÙŠØ©.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMedicalRecordsModal(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Ø¥ØºÙ„Ø§Ù‚
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMedicalRecordsModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                    aria-label="Ø¥ØºÙ„Ø§Ù‚"
                  >
                    Ã—
                  </button>
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
                Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³Ø¬Ù„Ø§Øª Ø·Ø¨ÙŠØ© Ø¨Ø¹Ø¯
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
                  <p className="text-sm font-bold text-teal-700">Ù„ÙˆØ­Ø© Ø§Ù„Ù…Ø±ÙŠØ¶</p>
                  <h2
                    id="notifications-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    ØªØ§Ø¨Ø¹ Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«Ø§Øª Ù…ÙˆØ§Ø¹ÙŠØ¯Ùƒ Ø§Ù„Ø·Ø¨ÙŠØ©.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNotificationsModal(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Ø¥ØºÙ„Ø§Ù‚
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNotificationsModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                    aria-label="Ø¥ØºÙ„Ø§Ù‚"
                  >
                    Ã—
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
                  <p className="text-sm font-bold text-teal-700">Ù„ÙˆØ­Ø© Ø§Ù„Ù…Ø±ÙŠØ¶</p>
                  <h2
                    id="upcoming-appointments-modal-title"
                    className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                  >
                    Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Ø£Ù‚Ø±Ø¨ Ø®Ù…Ø³Ø© Ù…ÙˆØ§Ø¹ÙŠØ¯ Ù…Ø±ØªØ¨Ø© Ø­Ø³Ø¨ Ø§Ù„ØªØ§Ø±ÙŠØ®.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/patient/book-appointment')}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800"
                  >
                    Ø­Ø¬Ø² Ù…ÙˆØ¹Ø¯ Ø¬Ø¯ÙŠØ¯
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAppointmentsModal(false)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Ø¥ØºÙ„Ø§Ù‚
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAppointmentsModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                    aria-label="Ø¥ØºÙ„Ø§Ù‚"
                  >
                    Ã—
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
                  Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯...
                </p>
              ) : upcomingAppointments.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                  <div className="hidden gap-px bg-slate-200 text-sm md:grid md:grid-cols-4">
                    <div className="bg-slate-50 p-3 font-bold text-slate-700">Ø§Ù„Ø·Ø¨ÙŠØ¨</div>
                    <div className="bg-slate-50 p-3 font-bold text-slate-700">Ø§Ù„ØªØ®ØµØµ</div>
                    <div className="bg-slate-50 p-3 font-bold text-slate-700">
                      ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…ÙˆØ¹Ø¯
                    </div>
                    <div className="bg-slate-50 p-3 font-bold text-slate-700">Ø§Ù„Ø­Ø§Ù„Ø©</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {upcomingAppointments.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="grid gap-3 bg-white p-4 text-sm md:grid-cols-4 md:gap-px md:p-0"
                      >
                        <div className="md:p-3">
                          <span className="block font-bold text-slate-500 md:hidden">
                            Ø§Ù„Ø·Ø¨ÙŠØ¨
                          </span>
                          <span className="font-semibold text-slate-950">
                            {appointment.doctor_name}
                          </span>
                        </div>
                        <div className="md:p-3">
                          <span className="block font-bold text-slate-500 md:hidden">
                            Ø§Ù„ØªØ®ØµØµ
                          </span>
                          <span className="text-slate-700">{appointment.specialty}</span>
                        </div>
                        <div className="md:p-3">
                          <span className="block font-bold text-slate-500 md:hidden">
                            ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…ÙˆØ¹Ø¯
                          </span>
                          <div className="flex flex-col items-start gap-1 md:items-end">
                            <div className="flex items-center gap-1 text-xl font-black text-teal-700">
                              <span>
                                {formatLocalAppointmentTime(appointment.appointment_date)}
                              </span>
                              <span aria-hidden="true">â°</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-bold text-slate-500">
                              <span>
                                {formatLocalAppointmentDate(appointment.appointment_date)}
                              </span>
                              <span aria-hidden="true">ðŸ“…</span>
                            </div>
                          </div>
                        </div>
                        <div className="md:p-3">
                          <span className="block font-bold text-slate-500 md:hidden">
                            Ø§Ù„Ø­Ø§Ù„Ø©
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
                  Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…ÙˆØ§Ø¹ÙŠØ¯ Ù‚Ø§Ø¯Ù…Ø©
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  )
}
