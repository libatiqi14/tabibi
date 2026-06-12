import { supabase } from '../lib/supabase'

export interface DoctorStats {
  totalPatients: number
  totalAppointments: number
  completedAppointments: number
  averageRating: number | null
  reviewsCount: number
}

export async function getDoctorStats(doctorId: string): Promise<DoctorStats> {
  const [
    { data: appointments, error: appointmentsError },
    { count: totalAppointments, error: totalAppointmentsError },
    { count: completedAppointments, error: completedAppointmentsError },
    { data: reviews, count: reviewsCount, error: reviewsError },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('patient_id')
      .eq('doctor_id', doctorId),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('status', 'completed'),
    supabase
      .from('doctor_reviews')
      .select('rating', { count: 'exact' })
      .eq('doctor_id', doctorId),
  ])

  const error =
    appointmentsError ||
    totalAppointmentsError ||
    completedAppointmentsError ||
    reviewsError

  if (error) {
    throw new Error(error.message)
  }

  const uniquePatients = new Set(
    (appointments ?? [])
      .map((appointment) => appointment.patient_id)
      .filter(Boolean),
  )
  const ratings = (reviews ?? []).map((review) => review.rating)
  const averageRating =
    ratings.length > 0
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null

  return {
    totalPatients: uniquePatients.size,
    totalAppointments: totalAppointments ?? 0,
    completedAppointments: completedAppointments ?? 0,
    averageRating,
    reviewsCount: reviewsCount ?? ratings.length,
  }
}
