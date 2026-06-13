import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../context/AuthContext'

const heroFeatures = [
  {
    icon: '⚡',
    title: 'حجز سريع',
    description: 'احجز موعدك في دقائق معدودة',
  },
  {
    icon: '🔔',
    title: 'إشعارات فورية',
    description: 'تذكيرات وتحديثات فورية',
  },
  {
    icon: '🛡️',
    title: 'أطباء موثوقون',
    description: 'أطباء معتمدون وذوو خبرة',
  },
  {
    icon: '📅',
    title: 'متابعة المواعيد',
    description: 'تابع مواعيدك وسجل زياراتك بسهولة',
  },
]

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
      className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-teal-50 via-white to-emerald-50 text-slate-950"
      dir="rtl"
      lang="ar"
    >
      <div className="pointer-events-none absolute -right-16 top-8 hidden h-56 w-56 rounded-full bg-teal-300/15 blur-3xl md:block lg:-right-24 lg:h-72 lg:w-72" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 hidden h-60 w-60 rounded-full bg-emerald-300/15 blur-3xl md:block lg:-bottom-28 lg:-left-24 lg:h-80 lg:w-80" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:gap-8 lg:grid lg:min-h-screen lg:grid-cols-2 lg:items-center lg:px-8">
        <section className="order-1 flex items-center justify-center text-center lg:text-right">
          <div className="w-full max-w-xl animate-[authFadeIn_600ms_ease-out_both]">
            <div className="inline-flex items-center gap-3 rounded-full border border-teal-100 bg-white/80 px-4 py-2 text-sm font-black text-teal-800 shadow-sm backdrop-blur">
              <span className="text-xl">🩺</span>
              <span>Tabibi</span>
            </div>

            <p className="mt-4 text-sm font-black text-teal-700 lg:mt-5">منصة المواعيد الطبية</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-normal text-slate-950 sm:text-4xl lg:mt-4 lg:text-5xl">
              احجز موعدك الطبي بسهولة
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm font-semibold leading-7 text-slate-600 sm:text-base sm:leading-8 lg:mx-0 lg:mt-5">
              منصة ذكية تربط المرضى بالأطباء وتساعدك على إدارة مواعيدك الطبية في مكان واحد.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-8 lg:gap-4">
              {heroFeatures.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-right shadow-md backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-2xl ring-1 ring-teal-100">
                    {feature.icon}
                  </span>
                  <h3 className="mt-4 text-base font-black text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-teal-100 bg-white/80 p-4 text-right shadow-md backdrop-blur sm:p-5 lg:mt-8">
              <p className="text-sm font-bold leading-7 text-teal-900">
                🔒 بياناتك محمية وآمنة داخل تجربة طبية حديثة مصممة للمرضى والأطباء.
              </p>
            </div>
          </div>
        </section>

        <section className="order-2 mt-6 flex items-center justify-center lg:mt-0">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-8 lg:rounded-3xl">
            <div className="mb-8 text-center">
              <span className="inline-flex rounded-full bg-teal-50 px-4 py-2 text-sm font-black text-teal-700 ring-1 ring-teal-100">
                نظام المواعيد الطبية
              </span>
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
          </div>
        </section>
      </div>

      <style>{`
        @keyframes authFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  )
}
