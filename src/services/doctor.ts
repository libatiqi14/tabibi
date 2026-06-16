import { supabase } from '../lib/supabase'
import type { Appointment } from './appointments'
import { doctorSelectFields, type Doctor } from './doctors'

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

export interface DoctorProfile extends Doctor {
  user_id: string | null
}

export type CreateDoctorProfileData = {
  user_id: string
  fullName: string
  specialty: string
  city?: string | null
  address?: string | null
  clinicName?: string | null
  phone?: string | null
  email?: string | null
}

export type UpdateDoctorProfessionalProfileData = {
  years_experience: number | null
  city: string | null
  address: string | null
  medical_school: string | null
  graduation_year: number | null
  biography: string | null
  languages: string[] | null
  previous_hospitals: string[] | null
}

const doctorProfileSelect = `user_id, ${doctorSelectFields}`

const allowedStatuses: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
]

type PatientProfile = {
  id: string
  full_name?: string | null
  email?: string | null
  phone?: string | null
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

  console.log('CURRENT USER ID', user.id)

  return user.id
}

export async function createDoctorProfile({
  user_id,
  fullName,
  specialty,
  city,
  address,
  clinicName,
  phone,
  email,
}: CreateDoctorProfileData): Promise<DoctorProfile> {
  const payload = {
    user_id,
    full_name: fullName,
    specialty,
    city: city ?? null,
    address: address ?? null,
    clinic_name: clinicName ?? null,
    phone: phone ?? null,
    email: email ?? null,
    active: true,
  }

  console.log('DOCTOR CREATION PAYLOAD', payload)

  const { data, error } = await supabase
    .from('doctors')
    .insert(payload)
    .select(doctorProfileSelect)
    .single()

  console.log('DOCTOR CREATION RESULT', data)
  console.log('DOCTOR CREATION ERROR', error)

  if (error?.code === '23505') {
    const { data: existingDoctor, error: existingError } = await supabase
      .from('doctors')
      .select(doctorProfileSelect)
      .eq('user_id', user_id)
      .single()

    console.log('DOCTOR FETCH AFTER DUPLICATE', existingDoctor)
    console.log('DOCTOR FETCH AFTER DUPLICATE ERROR', existingError)

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existingDoctor.user_id !== user_id) {
      throw new Error('Doctor profile was found but is not linked to the signed up user.')
    }

    return existingDoctor as DoctorProfile
  }

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.user_id !== user_id) {
    throw new Error('Doctor profile was created without a valid user_id link.')
  }

  return data as DoctorProfile
}

export async function getCurrentDoctor(): Promise<DoctorProfile> {
  const userId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('doctors')
    .select(doctorProfileSelect)
    .eq('user_id', userId)
    .maybeSingle()

  console.log('DOCTOR FETCH USER ID', userId)
  console.log('DOCTOR FETCH RESULT', data)
  console.log('DOCTOR FETCH ERROR', error)

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('No doctor profile is linked to the current user.')
  }

  console.log('DOCTOR PROFILE', data)
  console.log('DOCTOR ID', data.id)
  console.log('DOCTOR USER ID', data.user_id)

  return data as DoctorProfile
}

export async function updateDoctorProfessionalProfile(
  doctorId: string,
  profile: UpdateDoctorProfessionalProfileData,
): Promise<DoctorProfile> {
  const { data, error } = await supabase
    .from('doctors')
    .update(profile)
    .eq('id', doctorId)
    .select(doctorProfileSelect)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as DoctorProfile
}

export async function updateDoctorAvatar(
  doctorId: string,
  avatarUrl: string,
): Promise<DoctorProfile> {
  const { data, error } = await supabase
    .from('doctors')
    .update({ avatar_url: avatarUrl })
    .eq('id', doctorId)
    .select(doctorProfileSelect)
    .single()

  console.log('DOCTOR AVATAR UPDATE RESULT', data)
  console.log('DOCTOR AVATAR UPDATE ERROR', error)

  if (error) {
    throw new Error(error.message)
  }

  return data as DoctorProfile
}

export async function uploadDoctorAvatar(
  doctorId: string,
  file: File,
): Promise<DoctorProfile> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `doctors/${doctorId}/avatar.${extension}`

  console.log('DOCTOR AVATAR SELECTED FILE', file)
  console.log('DOCTOR AVATAR UPLOAD PATH', path)

  const { error: uploadError } = await supabase.storage
    .from('doctor-avatars')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = supabase.storage
    .from('doctor-avatars')
    .getPublicUrl(path)

  const publicUrl = `${data.publicUrl}?v=${Date.now()}`

  console.log('DOCTOR AVATAR PUBLIC URL', publicUrl)

  return updateDoctorAvatar(doctorId, publicUrl)
}

export async function getDoctorAppointments(): Promise<Appointment[]> {
  const doctor = await getCurrentDoctor()

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('doctor_id', doctor.id)
    .order('appointment_date', { ascending: true })

  console.log('CURRENT USER ID', doctor.user_id)
  console.log('DOCTOR PROFILE', doctor)
  console.log('DOCTOR ID', doctor.id)
  console.log('DOCTOR USER ID', doctor.user_id)
  console.log('APPOINTMENTS', data)
  console.log('ERROR', error)

  if (error) {
    throw new Error(error.message)
  }

  return attachPatientProfiles((data ?? []) as Appointment[])
}

async function attachPatientProfiles(
  appointments: Appointment[],
): Promise<Appointment[]> {
  const patientIds = Array.from(
    new Set(
      appointments
        .map((appointment) => appointment.patient_id)
        .filter(Boolean),
    ),
  )

  if (patientIds.length === 0) {
    return appointments
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .in('id', patientIds)

  if (error) {
    throw new Error(error.message)
  }

  const profilesById = new Map(
    ((data ?? []) as PatientProfile[]).map((profile) => [profile.id, profile]),
  )

  return appointments.map((appointment) => {
    const profile = profilesById.get(appointment.patient_id)

    return {
      ...appointment,
      patient: profile
        ? {
            full_name: profile.full_name ?? null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
          }
        : null,
    }
  })
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  if (!allowedStatuses.includes(status)) {
    throw new Error('Invalid appointment status.')
  }

  const doctor = await getCurrentDoctor()

  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .eq('doctor_id', doctor.id)
    .select('*')
    .single()

  console.log('CURRENT USER ID', doctor.user_id)
  console.log('DOCTOR PROFILE', doctor)
  console.log('DOCTOR ID', doctor.id)
  console.log('DOCTOR USER ID', doctor.user_id)
  console.log('APPOINTMENTS', data)
  console.log('ERROR', error)

  if (error) {
    throw new Error(error.message)
  }

  const [appointmentWithPatient] = await attachPatientProfiles([data as Appointment])

  return appointmentWithPatient
}
