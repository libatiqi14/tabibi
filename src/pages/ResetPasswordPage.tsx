import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (password.length < 6) {
      setErrorMessage('يجب أن تكون كلمة المرور 6 أحرف على الأقل.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين.')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        throw new Error(error.message)
      }

      setSuccessMessage('تم تغيير كلمة المرور بنجاح.')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تغيير كلمة المرور. يرجى فتح رابط إعادة التعيين من بريدك الإلكتروني والمحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page" dir="rtl" lang="ar">
      <section className="login-card" aria-labelledby="reset-password-title">
        <div className="login-header">
          <span className="login-badge">نظام المواعيد الطبية</span>
          <h1 id="reset-password-title">تعيين كلمة مرور جديدة</h1>
          <p>اختر كلمة مرور جديدة لحسابك ثم عد إلى تسجيل الدخول.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="password">كلمة المرور الجديدة</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="confirmPassword">تأكيد كلمة المرور</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="********"
              autoComplete="new-password"
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
            {isLoading ? 'جاري تغيير كلمة المرور...' : 'تغيير كلمة المرور'}
          </button>

          <p className="auth-link">
            <Link to="/login">العودة إلى تسجيل الدخول</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
