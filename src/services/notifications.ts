import { supabase } from '../lib/supabase'

export interface Notification {
  id: string
  user_id: string
  appointment_id: string | null
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export async function getMyNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, appointment_id, title, message, type, read, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Notification[]
}

export async function markNotificationAsRead(
  id: string,
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .select('id, user_id, appointment_id, title, message, type, read, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Notification
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}
