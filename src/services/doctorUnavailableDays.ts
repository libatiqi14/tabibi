import { supabase } from '../lib/supabase'

export interface DoctorUnavailableDay {
  id: string
  doctor_id: string
  unavailable_date: string
  reason?: string | null
  created_at: string
}

export type AddDoctorUnavailableDayInput = {
  doctor_id: string
  unavailable_date: string
  reason?: string | null
}

export async function getDoctorUnavailableDays(
  doctorId: string,
): Promise<DoctorUnavailableDay[]> {
  const { data, error } = await supabase
    .from('doctor_unavailable_days')
    .select('id, doctor_id, unavailable_date, reason, created_at')
    .eq('doctor_id', doctorId)
    .order('unavailable_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DoctorUnavailableDay[]
}

export async function addDoctorUnavailableDay({
  doctor_id,
  unavailable_date,
  reason,
}: AddDoctorUnavailableDayInput): Promise<DoctorUnavailableDay> {
  const { data, error } = await supabase
    .from('doctor_unavailable_days')
    .insert({
      doctor_id,
      unavailable_date,
      reason: reason?.trim() || null,
    })
    .select('id, doctor_id, unavailable_date, reason, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as DoctorUnavailableDay
}

export async function deleteDoctorUnavailableDay(id: string): Promise<void> {
  const { error } = await supabase
    .from('doctor_unavailable_days')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}
