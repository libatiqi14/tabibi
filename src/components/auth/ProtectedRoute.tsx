import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../context/AuthContext'

type ProtectedRouteProps = {
  children: ReactNode
  allowedRoles?: UserRole[]
}

function getDashboardPath(role: UserRole) {
  return role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  console.log('AUTH USER', user)
  console.log('PROFILE', profile)
  console.log('ROLE', profile?.role)

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4" dir="rtl" lang="ar">
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">جاري تحميل الحساب...</p>
        </div>
      </main>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={getDashboardPath(profile.role)} replace />
  }

  return children
}
