import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../context/AuthContext'

function getDashboardPath(role: UserRole) {
  if (role === 'admin') {
    return '/admin'
  }

  return role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      const { user, profile } = await signIn(email, password)

      console.log('AUTH USER', user)
      console.log('PROFILE', profile)
      console.log('ROLE', profile.role)

      navigate(getDashboardPath(profile.role), { replace: true })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page" dir="rtl" lang="ar">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-header">
          <span className="login-badge">نظام المواعيد الطبية</span>
          <h1 id="login-title">تسجيل الدخول</h1>
          <p>أدخل بيانات حسابك للوصول إلى لوحة التحكم المناسبة لدورك.</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage ? (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="login-button" type="submit" disabled={isLoading}>
            {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>

          <p className="auth-link">
            ليس لديك حساب؟ <Link to="/register">إنشاء حساب</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
