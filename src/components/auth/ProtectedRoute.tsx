import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { UserRole } from '../../context/AuthContext'
import { useAuth } from '../../hooks/useAuth'
import RoleBasedRoute from './RoleBasedRoute'

type ProtectedRouteProps = {
  children: ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  console.log('Auth loading', loading)
  console.log('User', user)
  console.log('Profile', profile)

  if (loading) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-slate-50 px-4"
        dir="rtl"
        lang="ar"
      >
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            جاري تحميل الحساب...
          </p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles) {
    return (
      <RoleBasedRoute allowedRoles={allowedRoles}>
        {children}
      </RoleBasedRoute>
    )
  }

  return children
}
