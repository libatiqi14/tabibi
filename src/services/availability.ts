import { supabase } from '../lib/supabase'

export interface DoctorAvailability {
  id: string
  doctor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  active: boolean
  created_at: string
}

export type SaveDoctorAvailabilityInput = {
  doctor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  active: boolean
}

export interface AvailableSlot {
  slot_start: string
  slot_end: string
}

export interface DoctorDaySlot {
  slot_start: string
  slot_end: string
  status: 'available' | 'booked'
}

export async function getDoctorAvailability(
  doctorId: string,
): Promise<DoctorAvailability[]> {
  const { data, error } = await supabase
    .from('doctor_availability')
    .select('id, doctor_id, day_of_week, start_time, end_time, active, created_at')
    .eq('doctor_id', doctorId)
    .order('day_of_week', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DoctorAvailability[]
}

export async function saveDoctorAvailability(
  availability: SaveDoctorAvailabilityInput[],
): Promise<DoctorAvailability[]> {
  const { data, error } = await supabase
    .from('doctor_availability')
    .upsert(availability, {
      onConflict: 'doctor_id,day_of_week',
    })
    .select('id, doctor_id, day_of_week, start_time, end_time, active, created_at')
    .order('day_of_week', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DoctorAvailability[]
}

export async function getAvailableSlots(
  doctorId: string,
  date: string,
): Promise<AvailableSlot[]> {
  console.log('GET AVAILABLE SLOTS PARAMS', {
    doctorId,
    date,
  })

  const { data, error } = await supabase.rpc('get_doctor_available_slots', {
    p_doctor_id: doctorId,
    p_date: date,
    p_slot_minutes: 10,
  })

  console.log('GET AVAILABLE SLOTS RESULT', data)
  console.log('GET AVAILABLE SLOTS ERROR', error)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as AvailableSlot[]
}

export async function getDoctorDaySlots(
  doctorId: string,
  date: string,
): Promise<DoctorDaySlot[]> {
  console.log('GET DOCTOR DAY SLOTS PARAMS', {
    doctorId,
    date,
  })

  const { data, error } = await supabase.rpc('get_doctor_day_slots', {
    p_doctor_id: doctorId,
    p_date: date,
    p_slot_minutes: 10,
  })

  console.log('GET DOCTOR DAY SLOTS RESULT', data)
  console.log('GET DOCTOR DAY SLOTS ERROR', error)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DoctorDaySlot[]
}
