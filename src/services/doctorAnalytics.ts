import { supabase } from '../lib/supabase'

type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

type AnalyticsAppointment = {
  id: string
  patient_id: string
  appointment_date: string
  status: string
  created_at: string
}

type AnalyticsReview = {
  rating: number
  created_at: string
}

export interface DoctorAnalytics {
  byStatus: Record<AppointmentStatus, number>
  todayAppointments: number
  weekAppointments: number
  monthAppointments: number
  cancelledRate: number
  completedRate: number
  newPatientsThisMonth: number
  monthlyAppointments: Array<{
    month: string
    count: number
  }>
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>
}

const statusKeys: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
]

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  const weekStart = startOfDay(date)
  weekStart.setDate(weekStart.getDate() - day)

  return weekStart
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getLastSixMonths(now: Date) {
  const currentMonth = startOfMonth(now)

  return Array.from({ length: 6 }, (_, index) => addMonths(currentMonth, index - 5))
}

export async function getDoctorAnalytics(
  doctorId: string,
): Promise<DoctorAnalytics> {
  const [
    { data: appointments, error: appointmentsError },
    { data: reviews, error: reviewsError },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, patient_id, appointment_date, status, created_at')
      .eq('doctor_id', doctorId),
    supabase
      .from('doctor_reviews')
      .select('rating, created_at')
      .eq('doctor_id', doctorId),
  ])

  const error = appointmentsError || reviewsError

  if (error) {
    throw new Error(error.message)
  }

  const doctorAppointments = (appointments ?? []) as AnalyticsAppointment[]
  const doctorReviews = (reviews ?? []) as AnalyticsReview[]
  const now = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

  const byStatus = statusKeys.reduce(
    (accumulator, status) => ({
      ...accumulator,
      [status]: doctorAppointments.filter(
        (appointment) => appointment.status === status,
      ).length,
    }),
    {
      scheduled: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    },
  )

  const totalAppointments = doctorAppointments.length
  const percentage = (count: number) =>
    totalAppointments > 0 ? (count / totalAppointments) * 100 : 0

  const isAppointmentInRange = (
    appointment: AnalyticsAppointment,
    start: Date,
    end?: Date,
  ) => {
    const appointmentDate = new Date(appointment.appointment_date)

    return appointmentDate >= start && (!end || appointmentDate < end)
  }

  const newPatientsThisMonth = new Set(
    doctorAppointments
      .filter((appointment) => {
        const createdAt = new Date(appointment.created_at)

        return createdAt >= monthStart && createdAt < nextMonthStart
      })
      .map((appointment) => appointment.patient_id)
      .filter(Boolean),
  ).size

  const lastSixMonths = getLastSixMonths(now)
  const monthlyAppointments = lastSixMonths.map((monthDate) => {
    const month = getMonthKey(monthDate)

    return {
      month,
      count: doctorAppointments.filter(
        (appointment) => getMonthKey(new Date(appointment.appointment_date)) === month,
      ).length,
    }
  })

  const ratingDistribution = doctorReviews.reduce<Record<1 | 2 | 3 | 4 | 5, number>>(
    (accumulator, review) => {
      if ([1, 2, 3, 4, 5].includes(review.rating)) {
        const rating = review.rating as 1 | 2 | 3 | 4 | 5
        accumulator[rating] += 1
      }

      return accumulator
    },
    {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  )

  return {
    byStatus,
    todayAppointments: doctorAppointments.filter((appointment) =>
      isAppointmentInRange(appointment, todayStart, tomorrowStart),
    ).length,
    weekAppointments: doctorAppointments.filter((appointment) =>
      isAppointmentInRange(appointment, weekStart),
    ).length,
    monthAppointments: doctorAppointments.filter((appointment) =>
      isAppointmentInRange(appointment, monthStart, nextMonthStart),
    ).length,
    cancelledRate: percentage(byStatus.cancelled),
    completedRate: percentage(byStatus.completed),
    newPatientsThisMonth,
    monthlyAppointments,
    ratingDistribution,
  }
}
