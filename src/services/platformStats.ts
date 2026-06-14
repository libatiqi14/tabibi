import { supabase } from '../lib/supabase'

export interface PlatformStats {
  totalDoctors: number
  totalPatients: number
  totalAppointments: number
  averageRating: number
}

function ensureCount(count: number | null, error: { message: string } | null) {
  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [doctorsResponse, patientsResponse, appointmentsResponse, ratingsResponse] =
    await Promise.all([
      supabase
        .from('doctors')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'patient'),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase.from('doctor_reviews').select('rating'),
    ])

  const totalDoctors = ensureCount(doctorsResponse.count, doctorsResponse.error)
  const totalPatients = ensureCount(patientsResponse.count, patientsResponse.error)
  const totalAppointments = ensureCount(
    appointmentsResponse.count,
    appointmentsResponse.error,
  )

  if (ratingsResponse.error) {
    throw new Error(ratingsResponse.error.message)
  }

  const ratings = ratingsResponse.data ?? []
  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) /
        ratings.length
      : 0

  return {
    totalDoctors,
    totalPatients,
    totalAppointments,
    averageRating,
  }
}
