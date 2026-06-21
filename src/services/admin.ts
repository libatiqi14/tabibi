import { supabase } from '../lib/supabase'

export interface AdminStats {
  totalPatients: number
  totalDoctors: number
  activeDoctors: number
  inactiveDoctors: number
  totalAppointments: number
  totalNotifications: number
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
  patient_id: string | null
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

export interface AdminDashboardFull {
  stats: AdminStats
  doctors: AdminDoctor[]
  patients: AdminPatient[]
  appointments: AdminAppointment[]
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
  patient_id: string | null
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

type AdminAppointmentCountMaps = {
  appointmentsByDoctor: Record<string, number>
  appointmentsByPatient: Record<string, number>
}

type AdminStatsRpcRow = {
  patients_count: number
  doctors_count: number
  active_doctors_count: number
  inactive_doctors_count: number
  appointments_count: number
  notifications_count: number
}

type AdminDashboardFullRpc = {
  stats: AdminStatsRpcRow
  doctors: Array<DoctorRow & {
    appointments_count: number
    reviews_count: number
    average_rating: number | null
  }>
  patients: Array<ProfileRow & {
    appointments_count: number
  }>
  appointments: Array<AppointmentRow & {
    patient_name: string | null
  }>
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

function safeNumber(value: unknown): number {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeAdminStats(stats: AdminStatsRpcRow): AdminStats {
  return {
    totalPatients: safeNumber(stats.patients_count),
    totalDoctors: safeNumber(stats.doctors_count),
    activeDoctors: safeNumber(stats.active_doctors_count),
    inactiveDoctors: safeNumber(stats.inactive_doctors_count),
    totalAppointments: safeNumber(stats.appointments_count),
    totalNotifications: safeNumber(stats.notifications_count),
  }
}

function logAdminQueryError(queryName: string, error: { message: string } | null) {
  if (error) {
    console.error(`Admin query failed: ${queryName}`, error)
  }
}

function getProfileName(
  profileById: Map<string, ProfileRow>,
  userId: string | null,
) {
  if (!userId) {
    return 'غير متوفر'
  }

  const profile = profileById.get(userId)

  return profile?.full_name || profile?.email || 'غير متوفر'
}

async function fetchAdminAppointments(): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, doctor_id, patient_id, doctor_name, specialty, status, appointment_date, created_at',
    )
    .order('appointment_date', { ascending: false })

  if (error) {
    console.error('Admin appointments query failed', error)
    throw new Error(error.message)
  }

  const appointments = (data ?? []) as AppointmentRow[]

  console.log('admin appointments', appointments)

  return appointments
}

function buildAdminAppointmentCountMaps(
  appointments: AppointmentRow[],
): AdminAppointmentCountMaps {
  const appointmentsByDoctor: Record<string, number> = {}
  const appointmentsByPatient: Record<string, number> = {}

  for (const appointment of appointments) {
    if (appointment.doctor_id) {
      appointmentsByDoctor[appointment.doctor_id] =
        (appointmentsByDoctor[appointment.doctor_id] ?? 0) + 1
    }

    if (appointment.patient_id) {
      appointmentsByPatient[appointment.patient_id] =
        (appointmentsByPatient[appointment.patient_id] ?? 0) + 1
    }
  }

  console.log('appointmentsByDoctor', appointmentsByDoctor)
  console.log('appointmentsByPatient', appointmentsByPatient)

  return {
    appointmentsByDoctor,
    appointmentsByPatient,
  }
}

async function loadAdminBaseData() {
  const [
    { data: profiles, error: profilesError },
    { data: doctors, error: doctorsError },
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
      .from('doctor_reviews')
      .select('id, appointment_id, doctor_id, patient_id, rating, comment, created_at')
      .order('created_at', { ascending: false }),
  ])

  logAdminQueryError('admin base profiles', profilesError)
  logAdminQueryError('admin base doctors', doctorsError)
  logAdminQueryError('admin base reviews', reviewsError)

  return {
    profiles: profilesError ? [] : ((profiles ?? []) as ProfileRow[]),
    doctors: doctorsError ? [] : ((doctors ?? []) as DoctorRow[]),
    reviews: reviewsError ? [] : ((reviews ?? []) as ReviewRow[]),
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_full')

  if (error) {
    console.error('Admin stats RPC error', error)
    throw new Error(error.message)
  }

  const payload = data as AdminDashboardFullRpc | null

  if (!payload?.stats) {
    throw new Error('Admin stats RPC returned no data.')
  }

  const stats = normalizeAdminStats(payload.stats)

  console.log('Admin stats', stats)

  return stats
}

export async function getAdminDashboardFull(
  filter: AdminAppointmentFilter = 'all',
): Promise<AdminDashboardFull> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_full')

  if (error) {
    console.error('Admin dashboard full RPC error', error)
    throw new Error(error.message)
  }

  console.log(data)

  const payload = data as AdminDashboardFullRpc | null

  if (!payload?.stats) {
    throw new Error('Admin dashboard RPC returned no data.')
  }

  const now = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

  const appointments = (payload.appointments ?? [])
    .filter((appointment) => {
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
    .map<AdminAppointment>((appointment) => ({
      id: appointment.id,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      doctor_name: appointment.doctor_name,
      specialty: appointment.specialty,
      appointment_date: appointment.appointment_date,
      status: appointment.status,
      created_at: appointment.created_at,
      patientName: appointment.patient_name || 'غير متوفر',
    }))

  return {
    stats: normalizeAdminStats(payload.stats),
    doctors: (payload.doctors ?? []).map((doctor) => ({
      ...doctor,
      averageRating:
        doctor.average_rating == null ? null : safeNumber(doctor.average_rating),
      reviewsCount: safeNumber(doctor.reviews_count),
      totalAppointments: safeNumber(doctor.appointments_count),
    })),
    patients: (payload.patients ?? []).map((patient) => ({
      id: patient.id,
      full_name: patient.full_name,
      email: patient.email,
      created_at: patient.created_at,
      totalAppointments: safeNumber(patient.appointments_count),
    })),
    appointments,
  }
}

export async function getDoctorsAdmin(): Promise<AdminDoctor[]> {
  const [doctorsResponse, appointments, reviewsResponse] = await Promise.all([
    supabase
      .from('doctors')
      .select(
        'id, user_id, full_name, specialty, clinic_name, city, address, phone, email, avatar_url, years_experience, medical_school, graduation_year, biography, languages, previous_hospitals, active, created_at',
      )
      .order('created_at', { ascending: false }),
    fetchAdminAppointments(),
    supabase.from('doctor_reviews').select('doctor_id, rating'),
  ])

  if (doctorsResponse.error) {
    console.error('Admin doctors query failed', doctorsResponse.error)
    throw new Error(doctorsResponse.error.message)
  }

  logAdminQueryError('doctor review metrics', reviewsResponse.error)

  const doctors = (doctorsResponse.data ?? []) as DoctorRow[]
  const { appointmentsByDoctor } = buildAdminAppointmentCountMaps(appointments)
  const ratingsByDoctor = new Map<string, number[]>()

  if (!reviewsResponse.error) {
    for (const review of reviewsResponse.data ?? []) {
      const doctorRatings = ratingsByDoctor.get(review.doctor_id) ?? []
      doctorRatings.push(review.rating)
      ratingsByDoctor.set(review.doctor_id, doctorRatings)
    }
  }

  return doctors.map((doctor) => {
    const doctorRatings = ratingsByDoctor.get(doctor.id) ?? []

    return {
      ...doctor,
      averageRating: average(doctorRatings),
      reviewsCount: doctorRatings.length,
      totalAppointments: appointmentsByDoctor[doctor.id] ?? 0,
    }
  })
}

export async function getPatientsAdmin(): Promise<AdminPatient[]> {
  const [{ data: profiles, error: profilesError }, appointments] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('role', 'patient')
      .order('created_at', { ascending: false }),
    fetchAdminAppointments(),
  ])

  if (profilesError) {
    console.error('Admin patients query failed', profilesError)
    throw new Error(profilesError.message)
  }

  const { appointmentsByPatient } = buildAdminAppointmentCountMaps(appointments)
  const patientProfiles = (profiles ?? []) as ProfileRow[]

  return patientProfiles.map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      created_at: profile.created_at,
      totalAppointments: appointmentsByPatient[profile.id] ?? 0,
    }))
}

export async function getAppointmentsAdmin(
  filter: AdminAppointmentFilter = 'all',
): Promise<AdminAppointment[]> {
  const [
    { data: profiles, error: profilesError },
    { data: doctors, error: doctorsError },
    appointments,
  ] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, role, created_at'),
    supabase.from('doctors').select('id, full_name'),
    fetchAdminAppointments(),
  ])

  if (profilesError) {
    console.error('Admin appointment profiles query failed', profilesError)
  }

  if (doctorsError) {
    console.error('Admin appointment doctors query failed', doctorsError)
  }

  const profileRows = profilesError ? [] : ((profiles ?? []) as ProfileRow[])
  const doctorRows = doctorsError
    ? []
    : ((doctors ?? []) as Array<{ id: string; full_name: string }>)
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const doctorById = new Map(doctorRows.map((doctor) => [doctor.id, doctor]))
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
    doctor_name:
      (appointment.doctor_id
        ? doctorById.get(appointment.doctor_id)?.full_name
        : null) ??
      appointment.doctor_name ??
      'غير متوفر',
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
  const [{ profiles, doctors, reviews }, appointments] = await Promise.all([
    loadAdminBaseData(),
    fetchAdminAppointments(),
  ])
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
