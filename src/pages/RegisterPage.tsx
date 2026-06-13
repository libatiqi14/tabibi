import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createDoctorProfile } from '../services/doctor'
import { getSpecialtyMeta, MEDICAL_SPECIALTIES } from '../utils/specialties'

const roleOptions: Array<{
  value: UserRole
  title: string
  icon: string
  description: string
}> = [
  {
    value: 'patient',
    title: 'مريض',
    icon: '👤',
    description: 'احجز المواعيد وتابع طلباتك الطبية بسهولة.',
  },
  {
    value: 'doctor',
    title: 'طبيب',
    icon: '👨‍⚕️',
    description: 'أدر مواعيد المرضى وجدولك الطبي من مكان واحد.',
  },
]

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

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [specialty, setSpecialty] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const resetForm = () => {
    setFullName('')
    setPhone('')
    setEmail('')
    setPassword('')
    setRole('')
    setSpecialty('')
    setClinicName('')
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!role) {
      setErrorMessage('يرجى اختيار نوع الحساب.')
      return
    }

    if (role === 'doctor' && !specialty.trim()) {
      setErrorMessage('يرجى اختيار تخصص الطبيب.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone.trim() || null,
            role,
            specialty: role === 'doctor' ? specialty.trim() : null,
            clinic_name: role === 'doctor' ? clinicName.trim() || null : null,
          },
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!data.user) {
        throw new Error('لم يتم إنشاء الحساب. يرجى المحاولة مرة أخرى.')
      }

      console.log('SIGNUP USER ID', data.user.id)
      console.log('PROFILE CREATION', {
        source: 'database trigger',
        id: data.user.id,
        full_name: fullName,
        role,
      })
      console.log('DOCTOR CREATION', {
        source: role === 'doctor' ? 'client insert with database trigger fallback' : 'not applicable',
        user_id: data.user.id,
        full_name: fullName,
        specialty: role === 'doctor' ? specialty.trim() : null,
        clinic_name: role === 'doctor' ? clinicName.trim() || null : null,
      })

      if (role === 'doctor') {
        const doctor = await createDoctorProfile({
          userId: data.user.id,
          fullName,
          specialty: specialty.trim(),
          clinicName: clinicName.trim() || null,
          phone: phone.trim() || null,
          email: data.user.email ?? email,
        })

        console.log('DOCTOR CREATION RESULT', doctor)
      }

      setSuccessMessage('تم إنشاء الحساب بنجاح. يمكنك تسجيل الدخول الآن.')
      resetForm()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى.'
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
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-2xl backdrop-blur sm:max-w-xl sm:p-8 lg:rounded-3xl">
            <div className="mb-8 text-center">
              <span className="inline-flex rounded-full bg-teal-50 px-4 py-2 text-sm font-black text-teal-700 ring-1 ring-teal-100">
                نظام المواعيد الطبية
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-normal text-slate-950">
                إنشاء حساب جديد
              </h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                اختر نوع الحساب وأدخل بياناتك للمتابعة.
              </p>
            </div>

            <form className="grid gap-5" onSubmit={handleRegister}>
              <fieldset className="grid gap-3">
                <legend className="text-sm font-bold text-slate-800">نوع الحساب</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleOptions.map((option) => {
                    const selected = role === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRole(option.value)}
                        className={`rounded-2xl border p-5 text-right shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                          selected
                            ? 'border-teal-600 bg-teal-50 ring-4 ring-teal-100'
                            : 'border-slate-100 bg-white hover:border-teal-200'
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-3xl ring-1 ring-teal-100">
                          {option.icon}
                        </span>
                        <span className="mt-4 block text-lg font-black text-slate-950">
                          {option.title}
                        </span>
                        <span className="mt-2 block text-sm font-semibold leading-7 text-slate-600">
                          {option.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-bold text-slate-800" htmlFor="fullName">
                    الاسم الكامل
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                      👤
                    </span>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      placeholder="أدخل الاسم الكامل"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-bold text-slate-800" htmlFor="phone">
                    رقم الهاتف
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                      📞
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      placeholder="اختياري"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      placeholder="name@example.com"
                      autoComplete="email"
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
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      placeholder="********"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              </div>

              {role === 'doctor' ? (
                <div className="grid gap-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 shadow-md sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-slate-800" htmlFor="specialty">
                      التخصص
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                        👨‍⚕️
                      </span>
                      <select
                        id="specialty"
                        value={specialty}
                        onChange={(event) => setSpecialty(event.target.value)}
                        className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                        required
                      >
                        <option value="">اختر التخصص</option>
                        {MEDICAL_SPECIALTIES.map((specialtyOption) => {
                          const meta = getSpecialtyMeta(specialtyOption)

                          return (
                            <option key={specialtyOption} value={specialtyOption}>
                              {meta.icon} {meta.labelAr}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-slate-800" htmlFor="clinicName">
                      اسم العيادة
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                        🏥
                      </span>
                      <input
                        id="clinicName"
                        type="text"
                        value={clinicName}
                        onChange={(event) => setClinicName(event.target.value)}
                        className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                        placeholder="اختياري"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {successMessage ? (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-14 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-black text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
              </button>

              <p className="text-center text-sm text-slate-600">
                لديك حساب بالفعل؟{' '}
                <Link
                  className="font-black text-teal-700 transition hover:text-teal-800 hover:underline"
                  to="/login"
                >
                  تسجيل الدخول
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
