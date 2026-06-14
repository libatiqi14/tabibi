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
    <main
      className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-teal-50 via-white to-emerald-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="pointer-events-none absolute -right-16 top-8 hidden h-56 w-56 rounded-full bg-teal-300/15 blur-3xl md:block lg:-right-24 lg:h-72 lg:w-72" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 hidden h-60 w-60 rounded-full bg-emerald-300/15 blur-3xl md:block lg:-bottom-28 lg:-left-24 lg:h-80 lg:w-80" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-start">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
              >
                <span>{'\u2190 \u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629'}</span>
              </Link>
            </div>
            <div className="mb-6 flex flex-col items-center gap-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-3xl text-white shadow-lg">
                {'\uD83E\uDE7A'}
              </span>
              <span className="text-2xl font-black text-slate-900">Tabibi</span>
              <span className="text-sm text-slate-500">
                {'\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0637\u0628\u064A\u0629'}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-normal text-slate-950">
              تسجيل الدخول
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
              أدخل بيانات حسابك للوصول إلى لوحة التحكم.
            </p>
          </div>

          <form className="grid gap-5" onSubmit={handleLogin}>
            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="email">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                  ✉️
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-bold text-slate-800" htmlFor="password">
                كلمة المرور
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                  🔒
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-500">بياناتك محمية وآمنة</span>
              <Link
                className="font-bold text-teal-700 transition hover:text-teal-800 hover:underline"
                to="/forgot-password"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            {errorMessage ? (
              <p
                className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              className="flex h-14 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-black text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>

            <p className="text-center text-sm text-slate-600">
              ليس لديك حساب؟{' '}
              <Link
                className="font-black text-teal-700 transition hover:text-teal-800 hover:underline"
                to="/register"
              >
                إنشاء حساب
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}
