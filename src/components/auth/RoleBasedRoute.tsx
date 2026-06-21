import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { UserRole } from '../../context/AuthContext'
import { useAuth } from '../../hooks/useAuth'

type RoleBasedRouteProps = {
  children: ReactNode
  allowedRoles: UserRole[]
}

function getDashboardPath(role: UserRole) {
  if (role === 'admin') {
    return '/admin'
  }

  return role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'
}

export default function RoleBasedRoute({
  children,
  allowedRoles,
}: RoleBasedRouteProps) {
  const { user, profile, loading, profileLoading } = useAuth()

  console.log('Auth loading', loading)
  console.log('User', user)
  console.log('Profile', profile)

  if (loading || profileLoading) {
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

  if (!profile) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-slate-50 px-4"
        dir="rtl"
        lang="ar"
      >
        <div className="max-w-md rounded-lg border border-rose-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-700">
            تعذر تحميل بيانات الحساب. يرجى تحديث الصفحة والمحاولة مرة أخرى.
          </p>
        </div>
      </main>
    )
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={getDashboardPath(profile.role)} replace />
  }

  return children
}
