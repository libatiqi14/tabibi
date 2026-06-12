import { supabase } from '../lib/supabase'
import type { UserRole } from '../context/AuthContext'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  phone?: string | null
  avatar_url?: string | null
  created_at?: string | null
}

export type CreateProfileData = {
  id: string
  email?: string | null
  full_name: string
  role: UserRole
  phone?: string | null
  avatar_url?: string | null
}

export type UpdateProfileData = Partial<
  Pick<Profile, 'email' | 'full_name' | 'role' | 'phone' | 'avatar_url'>
>

function isUserRole(role: string | null | undefined): role is UserRole {
  return role === 'admin' || role === 'doctor' || role === 'patient'
}

function assertProfileRole(role: string | null | undefined): UserRole {
  if (!isUserRole(role)) {
    throw new Error('Profile role is missing or invalid.')
  }

  return role
}

export async function getProfile(): Promise<Profile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!user) {
    throw new Error('User is not authenticated.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, avatar_url, created_at')
    .eq('id', user.id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    ...data,
    role: assertProfileRole(data.role),
  } as Profile
}

export async function createProfile(data: CreateProfileData): Promise<Profile> {
  console.log('PROFILE CREATION', {
    id: data.id,
    full_name: data.full_name,
    role: data.role,
  })

  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: data.id,
        email: data.email ?? null,
        full_name: data.full_name,
        role: data.role,
        phone: data.phone ?? null,
        avatar_url: data.avatar_url ?? null,
      },
      { onConflict: 'id' },
    )
    .select('id, email, full_name, role, phone, avatar_url, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    ...profile,
    role: assertProfileRole(profile.role),
  } as Profile
}

export async function updateProfile(data: UpdateProfileData): Promise<Profile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!user) {
    throw new Error('User is not authenticated.')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', user.id)
    .select('id, email, full_name, role, phone, avatar_url, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    ...profile,
    role: assertProfileRole(profile.role),
  } as Profile
}
