import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile } from '../services/profile'

export type UserRole = 'doctor' | 'patient'

export interface UserProfile {
  id: string
  email: string
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
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

type AuthProviderProps = {
  children: ReactNode
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function isUserRole(role: string | null | undefined): role is UserRole {
  return role === 'doctor' || role === 'patient'
}

async function fetchUserProfile(user: User): Promise<UserProfile> {
  const profile = await getProfile()

  if (profile.id !== user.id || !isUserRole(profile.role)) {
    throw new Error('User profile role is missing or invalid.')
  }

  return {
    id: user.id,
    email: profile.email ?? user.email ?? '',
    role: profile.role,
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const authRequestIdRef = useRef(0)

  const applyAuthenticatedUser = useCallback(async (nextUser: User | null) => {
    const requestId = authRequestIdRef.current + 1
    authRequestIdRef.current = requestId

    console.log('AUTH USER', nextUser)

    if (!nextUser) {
      setUser(null)
      setProfile(null)
      console.log('PROFILE', null)
      console.log('ROLE', undefined)
      return null
    }

    const nextProfile = await fetchUserProfile(nextUser)

    if (authRequestIdRef.current !== requestId) {
      return null
    }

    setUser(nextUser)
    setProfile(nextProfile)
    console.log('PROFILE', nextProfile)
    console.log('ROLE', nextProfile.role)

    return nextProfile
  }, [])

  useEffect(() => {
    let isMounted = true
    let authChangeTimer: number | undefined

    const restoreSession = async () => {
      setLoading(true)

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          throw new Error(error.message)
        }

        if (isMounted) {
          await applyAuthenticatedUser(session?.user ?? null)
        }
      } catch (error) {
        if (isMounted) {
          console.error('AUTH RESTORE ERROR', error)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void restoreSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authChangeTimer = window.setTimeout(() => {
        void (async () => {
          if (!isMounted) {
            return
          }

          setLoading(true)

          try {
            await applyAuthenticatedUser(session?.user ?? null)
          } catch (error) {
            console.error('AUTH STATE CHANGE ERROR', error)
            setUser(null)
            setProfile(null)
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        })()
      }, 0)
    })

    return () => {
      isMounted = false

      if (authChangeTimer) {
        window.clearTimeout(authChangeTimer)
      }

      subscription.unsubscribe()
    }
  }, [applyAuthenticatedUser])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true)

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

        const signedInProfile = await fetchUserProfile(signedInUser)
        setUser(signedInUser)
        setProfile(signedInProfile)
        console.log('AUTH USER', signedInUser)
        console.log('PROFILE', signedInProfile)
        console.log('ROLE', signedInProfile.role)

        return {
          user: signedInUser,
          profile: signedInProfile,
        }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    setLoading(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw new Error(error.message)
      }

      await applyAuthenticatedUser(null)
    } finally {
      setLoading(false)
    }
  }, [applyAuthenticatedUser])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signOut,
    }),
    [user, profile, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
