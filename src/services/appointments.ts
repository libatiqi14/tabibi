import { supabase } from '../lib/supabase'

export interface Appointment {
  id: string
  patient_id: string
  doctor_id?: string | null
  doctor_name: string
  specialty: string
  appointment_date: string
  status: string
  notes?: string | null
  created_at: string
  patient?: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

export type CreateAppointmentData = {
  doctor_id: string
  doctor_name: string
  specialty: string
  appointment_date: string
  notes?: string | null
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

export async function getPatientAppointments(): Promise<Appointment[]> {
  const patientId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data as Appointment[]
}

export async function createAppointment(
  data: CreateAppointmentData,
): Promise<Appointment> {
  const patientId = await getCurrentUserId()

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      doctor_id: data.doctor_id,
      doctor_name: data.doctor_name,
      specialty: data.specialty,
      appointment_date: data.appointment_date,
      notes: data.notes ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return appointment as Appointment
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  const patientId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('patient_id', patientId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Appointment
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
): Promise<Appointment> {
  const patientId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('appointments')
    .update({ appointment_date: newDate })
    .eq('id', appointmentId)
    .eq('patient_id', patientId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Appointment
}
