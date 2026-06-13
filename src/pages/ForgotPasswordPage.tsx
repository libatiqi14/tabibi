import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        throw new Error(error.message)
      }

      setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.')
      setEmail('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إرسال رابط إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page" dir="rtl" lang="ar">
      <section className="login-card" aria-labelledby="forgot-password-title">
        <div className="login-header">
          <span className="login-badge">نظام المواعيد الطبية</span>
          <h1 id="forgot-password-title">استعادة كلمة المرور</h1>
          <p>أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
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

          {successMessage ? (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="login-button" type="submit" disabled={isLoading}>
            {isLoading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
          </button>

          <p className="auth-link">
            تذكرت كلمة المرور؟ <Link to="/login">تسجيل الدخول</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
