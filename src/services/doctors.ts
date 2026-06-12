import { supabase } from '../lib/supabase'

export interface Doctor {
  id: string
  full_name: string
  specialty: string
  clinic_name?: string | null
  phone?: string | null
  email?: string | null
  avatar_url?: string | null
  years_experience?: number | null
  medical_school?: string | null
  graduation_year?: number | null
  biography?: string | null
  languages?: string[] | null
  previous_hospitals?: string[] | null
  active?: boolean | null
  created_at?: string | null
}

export const doctorSelectFields =
  'id, full_name, specialty, clinic_name, phone, email, avatar_url, years_experience, medical_school, graduation_year, biography, languages, previous_hospitals, active, created_at'

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
