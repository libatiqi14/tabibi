import { supabase } from '../lib/supabase'

export interface AdminStats {
  totalPatients: number
  totalDoctors: number
  totalAppointments: number
  totalReviews: number
  totalNotifications: number
  averagePlatformRating: number | null
}

export interface AdminDoctor {
  id: string
  user_id: string | null
  full_name: string
  specialty: string
  clinic_name: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  years_experience: number | null
  medical_school: string | null
  graduation_year: number | null
  biography: string | null
  languages: string[] | null
  previous_hospitals: string[] | null
  active: boolean | null
  created_at: string | null
  averageRating: number | null
  reviewsCount: number
  totalAppointments: number
}

export interface AdminPatient {
  id: string
  full_name: string | null
  email: string | null
  created_at: string | null
  totalAppointments: number
}

export interface AdminAppointment {
  id: string
  patient_id: string
  doctor_id: string | null
  doctor_name: string
  specialty: string
  appointment_date: string
  status: string
  created_at: string
  patientName: string
}

export interface AdminReview {
  id: string
  appointment_id: string
  doctor_id: string
  patient_id: string
  rating: number
  comment: string | null
  created_at: string
  patientName: string
  doctorName: string
}

export interface AdminPlatformAnalytics {
  appointmentsByMonth: Array<{ month: string; count: number }>
  newUsersByMonth: Array<{ month: string; count: number }>
  doctorsBySpecialty: Array<{ specialty: string; count: number }>
  ratingsDistribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export type AdminAppointmentFilter =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'completed'
  | 'cancelled'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  created_at: string | null
}

type DoctorRow = {
  id: string
  user_id: string | null
  full_name: string
  specialty: string
  clinic_name: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  years_experience: number | null
  medical_school: string | null
  graduation_year: number | null
  biography: string | null
  languages: string[] | null
  previous_hospitals: string[] | null
  active: boolean | null
  created_at: string | null
}

type AppointmentRow = {
  id: string
  patient_id: string
  doctor_id: string | null
  doctor_name: string
  specialty: string
  appointment_date: string
  status: string
  created_at: string
}

type ReviewRow = {
  id: string
  appointment_id: string
  doctor_id: string
  patient_id: string
  rating: number
  comment: string | null
  created_at: string
}

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

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null
}

function getProfileName(profileById: Map<string, ProfileRow>, userId: string) {
  const profile = profileById.get(userId)

  return profile?.full_name || profile?.email || 'غير متوفر'
}

async function loadAdminBaseData() {
  const [
    { data: profiles, error: profilesError },
    { data: doctors, error: doctorsError },
    { data: appointments, error: appointmentsError },
    { data: reviews, error: reviewsError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('doctors')
      .select(
        'id, user_id, full_name, specialty, clinic_name, city, address, phone, email, avatar_url, years_experience, medical_school, graduation_year, biography, languages, previous_hospitals, active, created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('appointments')
      .select(
        'id, patient_id, doctor_id, doctor_name, specialty, appointment_date, status, created_at',
      )
      .order('appointment_date', { ascending: false }),
    supabase
      .from('doctor_reviews')
      .select('id, appointment_id, doctor_id, patient_id, rating, comment, created_at')
      .order('created_at', { ascending: false }),
  ])

  const error = profilesError || doctorsError || appointmentsError || reviewsError

  if (error) {
    throw new Error(error.message)
  }

  return {
    profiles: (profiles ?? []) as ProfileRow[],
    doctors: (doctors ?? []) as DoctorRow[],
    appointments: (appointments ?? []) as AppointmentRow[],
    reviews: (reviews ?? []) as ReviewRow[],
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const [
    { count: totalPatients, error: patientsError },
    { count: totalDoctors, error: doctorsError },
    { count: totalAppointments, error: appointmentsError },
    { count: totalReviews, error: reviewsCountError },
    { count: totalNotifications, error: notificationsError },
    { data: reviews, error: reviewsError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'patient'),
    supabase
      .from('doctors')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('doctor_reviews')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true }),
    supabase.from('doctor_reviews').select('rating'),
  ])

  const error =
    patientsError ||
    doctorsError ||
    appointmentsError ||
    reviewsCountError ||
    notificationsError ||
    reviewsError

  if (error) {
    throw new Error(error.message)
  }

  return {
    totalPatients: totalPatients ?? 0,
    totalDoctors: totalDoctors ?? 0,
    totalAppointments: totalAppointments ?? 0,
    totalReviews: totalReviews ?? 0,
    totalNotifications: totalNotifications ?? 0,
    averagePlatformRating: average((reviews ?? []).map((review) => review.rating)),
  }
}

export async function getDoctorsAdmin(): Promise<AdminDoctor[]> {
  const { doctors, appointments, reviews } = await loadAdminBaseData()

  return doctors.map((doctor) => {
    const doctorAppointments = appointments.filter(
      (appointment) => appointment.doctor_id === doctor.id,
    )
    const doctorReviews = reviews.filter((review) => review.doctor_id === doctor.id)

    return {
      ...doctor,
      averageRating: average(doctorReviews.map((review) => review.rating)),
      reviewsCount: doctorReviews.length,
      totalAppointments: doctorAppointments.length,
    }
  })
}

export async function getPatientsAdmin(): Promise<AdminPatient[]> {
  const { profiles, appointments } = await loadAdminBaseData()

  return profiles
    .filter((profile) => profile.role === 'patient')
    .map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      created_at: profile.created_at,
      totalAppointments: appointments.filter(
        (appointment) => appointment.patient_id === profile.id,
      ).length,
    }))
}

export async function getAppointmentsAdmin(
  filter: AdminAppointmentFilter = 'all',
): Promise<AdminAppointment[]> {
  const { profiles, appointments } = await loadAdminBaseData()
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const now = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

  const filteredAppointments = appointments.filter((appointment) => {
    const appointmentDate = new Date(appointment.appointment_date)

    if (filter === 'today') {
      return appointmentDate >= todayStart && appointmentDate < tomorrowStart
    }

    if (filter === 'week') {
      return appointmentDate >= weekStart
    }

    if (filter === 'month') {
      return appointmentDate >= monthStart && appointmentDate < nextMonthStart
    }

    if (filter === 'completed' || filter === 'cancelled') {
      return appointment.status === filter
    }

    return true
  })

  return filteredAppointments.map((appointment) => ({
    ...appointment,
    patientName: getProfileName(profileById, appointment.patient_id),
  }))
}

export async function getReviewsAdmin(): Promise<AdminReview[]> {
  const { profiles, doctors, reviews } = await loadAdminBaseData()
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]))

  return reviews.map((review) => ({
    ...review,
    patientName: getProfileName(profileById, review.patient_id),
    doctorName: doctorById.get(review.doctor_id)?.full_name ?? 'غير متوفر',
  }))
}

export async function toggleDoctorStatus(
  doctorId: string,
  active: boolean,
): Promise<AdminDoctor> {
  const { data, error } = await supabase
    .from('doctors')
    .update({ active })
    .eq('id', doctorId)
    .select(
      'id, user_id, full_name, specialty, clinic_name, city, address, phone, email, avatar_url, years_experience, medical_school, graduation_year, biography, languages, previous_hospitals, active, created_at',
    )
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    ...(data as DoctorRow),
    averageRating: null,
    reviewsCount: 0,
    totalAppointments: 0,
  }
}

export async function deleteReviewAdmin(reviewId: string): Promise<void> {
  const { error } = await supabase.from('doctor_reviews').delete().eq('id', reviewId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getPlatformAnalytics(): Promise<AdminPlatformAnalytics> {
  const { profiles, doctors, appointments, reviews } = await loadAdminBaseData()
  const lastSixMonths = getLastSixMonths(new Date())

  const appointmentsByMonth = lastSixMonths.map((monthDate) => {
    const month = getMonthKey(monthDate)

    return {
      month,
      count: appointments.filter(
        (appointment) => getMonthKey(new Date(appointment.appointment_date)) === month,
      ).length,
    }
  })

  const newUsersByMonth = lastSixMonths.map((monthDate) => {
    const month = getMonthKey(monthDate)

    return {
      month,
      count: profiles.filter((profile) => {
        if (!profile.created_at) {
          return false
        }

        return getMonthKey(new Date(profile.created_at)) === month
      }).length,
    }
  })

  const specialtyCounts = doctors.reduce<Record<string, number>>((accumulator, doctor) => {
    accumulator[doctor.specialty] = (accumulator[doctor.specialty] ?? 0) + 1
    return accumulator
  }, {})

  const ratingsDistribution = reviews.reduce<Record<1 | 2 | 3 | 4 | 5, number>>(
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
    appointmentsByMonth,
    newUsersByMonth,
    doctorsBySpecialty: Object.entries(specialtyCounts).map(
      ([specialty, count]) => ({
        specialty,
        count,
      }),
    ),
    ratingsDistribution,
  }
}
