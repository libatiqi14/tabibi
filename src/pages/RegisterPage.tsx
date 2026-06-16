import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { UserRole } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createDoctorProfile } from '../services/doctor'
import { createProfile } from '../services/profile'
import { MOROCCAN_CITIES } from '../utils/cities'
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

export default function RegisterPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [specialty, setSpecialty] = useState('')
  const [city, setCity] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const resetForm = () => {
    setFullName('')
    setPhone('')
    setEmail('')
    setPassword('')
    setRole('')
    setSpecialty('')
    setCity('')
    setClinicName('')
    setStatusMessage('')
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setStatusMessage('')

    if (!role) {
      setErrorMessage('يرجى اختيار نوع الحساب.')
      return
    }

    if (role === 'doctor' && !specialty.trim()) {
      setErrorMessage('\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u062A\u062E\u0635\u0635 \u0627\u0644\u0637\u0628\u064A\u0628.')
      return
    }

    if (role === 'doctor' && !city.trim()) {
      setErrorMessage('\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629.')
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
            city: role === 'doctor' ? city.trim() : null,
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

      const profileEmail = data.user.email ?? email

      console.log('SIGNUP USER ID', data.user.id)
      console.log('PROFILE CREATION', {
        source: 'database trigger',
        id: data.user.id,
        email: profileEmail,
        full_name: fullName,
        role,
      })

      if (data.session) {
        await createProfile({
          id: data.user.id,
          email: profileEmail,
          full_name: fullName,
          role,
          phone: phone.trim() || null,
        })
      }

      console.log('DOCTOR CREATION', {
        source: role === 'doctor' ? 'client insert with database trigger fallback' : 'not applicable',
        user_id: data.user.id,
        full_name: fullName,
        specialty: role === 'doctor' ? specialty.trim() : null,
        city: role === 'doctor' ? city.trim() : null,
        clinic_name: role === 'doctor' ? clinicName.trim() || null : null,
      })

      if (role === 'doctor' && data.session) {
        const doctor = await createDoctorProfile({
          user_id: data.user.id,
          fullName,
          specialty: specialty.trim(),
          city: city.trim(),
          clinicName: clinicName.trim() || null,
          phone: phone.trim() || null,
          email: profileEmail,
        })

        console.log('DOCTOR CREATION RESULT', doctor)
      } else if (role === 'doctor') {
        console.log('DOCTOR CREATION SKIPPED CLIENT INSERT', {
          reason: 'No authenticated session after sign up. Database trigger must create linked doctor row.',
          user_id: data.user.id,
        })
      }

      setStatusMessage('جاري تسجيل الدخول...')

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        navigate('/login', { replace: true })
        return
      }

      resetForm()
      navigate(role === 'doctor' ? '/doctor' : '/patient', { replace: true })
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
      className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-teal-50 via-white to-emerald-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="pointer-events-none absolute -right-16 top-8 hidden h-56 w-56 rounded-full bg-teal-300/15 blur-3xl md:block lg:-right-24 lg:h-72 lg:w-72" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 hidden h-60 w-60 rounded-full bg-emerald-300/15 blur-3xl md:block lg:-bottom-28 lg:-left-24 lg:h-80 lg:w-80" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
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
                  <label className="text-sm font-bold text-slate-800" htmlFor="city">
                    {'\u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg">
                      {'\uD83D\uDCCD'}
                    </span>
                    <select
                      id="city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      required
                    >
                      <option value="">
                        {'\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
                      </option>
                      {MOROCCAN_CITIES.map((cityOption) => (
                        <option key={cityOption} value={cityOption}>
                          {cityOption}
                        </option>
                      ))}
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

            {statusMessage ? (
              <p className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold leading-7 text-teal-700">
                {statusMessage}
              </p>
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
              {statusMessage || (isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب')}
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
        </section>
      </div>
    </main>
  )
}
