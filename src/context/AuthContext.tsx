import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile } from '../services/profile'

export type UserRole = 'admin' | 'doctor' | 'patient'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
}

type SignInResult = {
  user: User
  profile: UserProfile
}

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

type AuthProviderProps = {
  children: ReactNode
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function isUserRole(role: string | null | undefined): role is UserRole {
  return role === 'admin' || role === 'doctor' || role === 'patient'
}

async function fetchUserProfile(user: User): Promise<UserProfile> {
  const profile = await getProfile()

  if (profile.id !== user.id || !isUserRole(profile.role)) {
    throw new Error('User profile role is missing or invalid.')
  }

  return {
    id: user.id,
    email: profile.email ?? user.email ?? '',
    full_name: profile.full_name,
    role: profile.role,
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const profileRequestIdRef = useRef(0)

  const loadProfile = useCallback(async (nextUser: User | null) => {
    const requestId = profileRequestIdRef.current + 1
    profileRequestIdRef.current = requestId

    if (!nextUser) {
      setProfile(null)
      setProfileLoading(false)
      return null
    }

    setProfileLoading(true)

    try {
      const nextProfile = await fetchUserProfile(nextUser)

      if (profileRequestIdRef.current !== requestId) {
        return null
      }

      setProfile(nextProfile)
      console.log('Profile', nextProfile)
      console.log('ROLE', nextProfile.role)
      return nextProfile
    } catch (error) {
      if (profileRequestIdRef.current === requestId) {
        setProfile(null)
      }

      throw error
    } finally {
      if (profileRequestIdRef.current === requestId) {
        setProfileLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      setLoading(true)

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          throw new Error(error.message)
        }

        if (!isMounted) {
          return
        }

        console.log('Initial session', session)
        const initialUser = session?.user ?? null
        setUser(initialUser)
        console.log('User', initialUser)
        setLoading(false)
        console.log('Auth loading', false)

        try {
          await loadProfile(initialUser)
        } catch (error) {
          console.error('PROFILE RESTORE ERROR', error)
        }
      } catch (error) {
        if (isMounted) {
          console.error('AUTH RESTORE ERROR', error)
          setUser(null)
          setProfile(null)
          setProfileLoading(false)
          setLoading(false)
          console.log('Auth loading', false)
          console.log('User', null)
          console.log('Profile', null)
        }
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted || event === 'INITIAL_SESSION') {
        return
      }

      if (event === 'SIGNED_OUT') {
        profileRequestIdRef.current += 1
        setUser(null)
        setProfile(null)
        setProfileLoading(false)
        console.log('User', null)
        console.log('Profile', null)
        return
      }

      if (!session?.user) {
        return
      }

      const nextUser = session.user
      setUser(nextUser)
      console.log('User', nextUser)

      window.setTimeout(() => {
        if (!isMounted) {
          return
        }

        void loadProfile(nextUser).catch((error) => {
          console.error('AUTH PROFILE CHANGE ERROR', error)
        })
      }, 0)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      console.log('Auth loading', true)

      try {
        const {
          data: { user: signedInUser },
          error,
        } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw new Error(error.message)
        }

        if (!signedInUser) {
          throw new Error('Sign in succeeded but no user was returned.')
        }

        setUser(signedInUser)
        console.log('User', signedInUser)
        setProfileLoading(true)
        const signedInProfile = await fetchUserProfile(signedInUser)
        setProfile(signedInProfile)
        setProfileLoading(false)

        return {
          user: signedInUser,
          profile: signedInProfile,
        }
      } finally {
        setProfileLoading(false)
        setLoading(false)
        console.log('Auth loading', false)
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    setLoading(true)
    console.log('Auth loading', true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw new Error(error.message)
      }

      profileRequestIdRef.current += 1
      setUser(null)
      setProfile(null)
      setProfileLoading(false)
      console.log('User', null)
      console.log('Profile', null)
    } finally {
      setLoading(false)
      console.log('Auth loading', false)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      signIn,
      signOut,
    }),
    [user, profile, loading, profileLoading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
