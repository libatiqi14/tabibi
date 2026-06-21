import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable.')
}

const authStorageKey = 'tabibi-auth-session'
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
const legacyAuthStorageKey = `sb-${projectRef}-auth-token`

if (
  !window.localStorage.getItem(authStorageKey) &&
  window.localStorage.getItem(legacyAuthStorageKey)
) {
  window.localStorage.setItem(
    authStorageKey,
    window.localStorage.getItem(legacyAuthStorageKey) as string,
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: authStorageKey,
  },
})
