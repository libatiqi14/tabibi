import { supabase } from '../lib/supabase'

export interface Doctor {
  id: string
  full_name: string
  specialty: string
  clinic_name?: string | null
  phone?: string | null
  email?: string | null
  avatar_url?: string | null
  city?: string | null
  address?: string | null
  years_experience?: number | null
  medical_school?: string | null
  graduation_year?: number | null
  biography?: string | null
  languages?: string[] | null
  previous_hospitals?: string[] | null
  active?: boolean | null
  created_at?: string | null
}

export interface FeaturedDoctor extends Doctor {
  average_rating: number | null
  reviews_count: number
}

export const doctorSelectFields =
  'id, full_name, specialty, clinic_name, phone, email, avatar_url, city, address, years_experience, medical_school, graduation_year, biography, languages, previous_hospitals, active, created_at'

export async function getSpecialties(): Promise<string[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('specialty')
    .eq('active', true)
    .order('specialty', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const specialties = new Set(
    (data ?? [])
      .map((doctor) => doctor.specialty)
      .filter((specialty): specialty is string => Boolean(specialty)),
  )

  return Array.from(specialties)
}

export async function getDoctorsBySpecialty(specialty: string): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select(doctorSelectFields)
    .eq('active', true)
    .eq('specialty', specialty)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Doctor[]
}

export async function getDoctorsByCityAndSpecialty(
  city: string,
  specialty: string,
): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select(doctorSelectFields)
    .eq('active', true)
    .eq('city', city)
    .eq('specialty', specialty)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Doctor[]
}

export async function getCitiesWithDoctors(): Promise<string[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('city')
    .eq('active', true)
    .not('city', 'is', null)
    .order('city', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const cities = new Set(
    (data ?? [])
      .map((doctor) => doctor.city)
      .filter((city): city is string => Boolean(city)),
  )

  return Array.from(cities)
}

export async function getFeaturedDoctors(limit = 6): Promise<FeaturedDoctor[]> {
  const { data: doctors, error: doctorsError } = await supabase
    .from('doctors')
    .select(doctorSelectFields)
    .eq('active', true)

  if (doctorsError) {
    throw new Error(doctorsError.message)
  }

  const activeDoctors = (doctors ?? []) as Doctor[]

  const doctorsWithStats = await Promise.all(
    activeDoctors.map(async (doctor) => {
      const { data: reviews, error: reviewsError } = await supabase
        .from('doctor_reviews')
        .select('rating')
        .eq('doctor_id', doctor.id)

      if (reviewsError) {
        throw new Error(reviewsError.message)
      }

      const ratings = (reviews ?? []).map((review) => review.rating)
      const averageRating =
        ratings.length > 0
          ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
          : null

      return {
        ...doctor,
        average_rating: averageRating,
        reviews_count: ratings.length,
      }
    }),
  )

  return doctorsWithStats
    .sort((firstDoctor, secondDoctor) => {
      const ratingDifference =
        (secondDoctor.average_rating ?? 0) - (firstDoctor.average_rating ?? 0)

      if (ratingDifference !== 0) {
        return ratingDifference
      }

      return secondDoctor.reviews_count - firstDoctor.reviews_count
    })
    .slice(0, limit)
}
