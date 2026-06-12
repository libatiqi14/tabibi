import { supabase } from '../lib/supabase'

export interface DoctorReview {
  id: string
  appointment_id: string
  doctor_id: string
  patient_id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface DoctorReviewStats {
  averageRating: number | null
  reviewCount: number
}

export type CreateDoctorReviewData = {
  appointment_id: string
  doctor_id: string
  rating: number
  comment?: string | null
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  if (!user) {
    throw new Error('User is not authenticated.')
  }

  return user.id
}

export async function getDoctorReviewStats(
  doctorId: string,
): Promise<DoctorReviewStats> {
  const { data, error, count } = await supabase
    .from('doctor_reviews')
    .select('rating', { count: 'exact' })
    .eq('doctor_id', doctorId)

  if (error) {
    throw new Error(error.message)
  }

  const ratings = (data ?? []).map((review) => review.rating)
  const averageRating =
    ratings.length > 0
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null

  return {
    averageRating,
    reviewCount: count ?? ratings.length,
  }
}

export async function getDoctorReviews(
  doctorId: string,
): Promise<DoctorReview[]> {
  const { data, error } = await supabase
    .from('doctor_reviews')
    .select('id, appointment_id, doctor_id, patient_id, rating, comment, created_at')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DoctorReview[]
}

export async function createDoctorReview({
  appointment_id,
  doctor_id,
  rating,
  comment,
}: CreateDoctorReviewData): Promise<DoctorReview> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.')
  }

  const patientId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('doctor_reviews')
    .insert({
      appointment_id,
      doctor_id,
      patient_id: patientId,
      rating,
      comment: comment?.trim() || null,
    })
    .select('id, appointment_id, doctor_id, patient_id, rating, comment, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as DoctorReview
}

export async function getPatientReviewForAppointment(
  appointmentId: string,
): Promise<DoctorReview | null> {
  const patientId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('doctor_reviews')
    .select('id, appointment_id, doctor_id, patient_id, rating, comment, created_at')
    .eq('appointment_id', appointmentId)
    .eq('patient_id', patientId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? null) as DoctorReview | null
}
