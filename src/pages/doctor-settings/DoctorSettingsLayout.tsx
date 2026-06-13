import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type DoctorSettingsLayoutProps = {
  title: string
  description: string
  children: ReactNode
}

export default function DoctorSettingsLayout({
  title,
  description,
  children,
}: DoctorSettingsLayoutProps) {
  const navigate = useNavigate()

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-teal-700">إعدادات الطبيب</p>
            <h1 className="mt-2 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/doctor/dashboard')}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← الرجوع إلى لوحة الطبيب
          </button>
        </header>

        {children}
      </div>
    </main>
  )
}
