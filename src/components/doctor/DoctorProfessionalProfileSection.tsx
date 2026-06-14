import { useEffect, useState } from 'react'
import {
  updateDoctorProfessionalProfile,
  type DoctorProfile,
} from '../../services/doctor'
import { MOROCCAN_CITIES } from '../../utils/cities'

type DoctorProfessionalProfileSectionProps = {
  doctor: DoctorProfile
  onDoctorChange: (doctor: DoctorProfile) => void
}

type ProfessionalProfileForm = {
  yearsExperience: string
  city: string
  address: string
  medicalSchool: string
  graduationYear: string
  biography: string
  languages: string
  previousHospitals: string
}

function arrayToText(value?: string[] | null) {
  return value?.join('\n') ?? ''
}

function textToArray(value: string) {
  const items = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : null
}

function buildForm(doctor: DoctorProfile): ProfessionalProfileForm {
  return {
    yearsExperience: doctor.years_experience?.toString() ?? '',
    city: doctor.city ?? '',
    address: doctor.address ?? '',
    medicalSchool: doctor.medical_school ?? '',
    graduationYear: doctor.graduation_year?.toString() ?? '',
    biography: doctor.biography ?? '',
    languages: arrayToText(doctor.languages),
    previousHospitals: arrayToText(doctor.previous_hospitals),
  }
}

export default function DoctorProfessionalProfileSection({
  doctor,
  onDoctorChange,
}: DoctorProfessionalProfileSectionProps) {
  const [form, setForm] = useState<ProfessionalProfileForm>(() =>
    buildForm(doctor),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setForm(buildForm(doctor))
  }, [doctor])

  const updateForm = (
    field: keyof ProfessionalProfileForm,
    value: string,
  ) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const handleSave = async () => {
    setErrorMessage('')
    setSuccessMessage('')

    const currentYear = new Date().getFullYear()
    const yearsExperience = form.yearsExperience
      ? Number(form.yearsExperience)
      : null
    const graduationYear = form.graduationYear
      ? Number(form.graduationYear)
      : null

    if (
      yearsExperience !== null &&
      (!Number.isInteger(yearsExperience) || yearsExperience < 0)
    ) {
      setErrorMessage('سنوات الخبرة يجب أن تكون رقما أكبر من أو يساوي صفر.')
      return
    }

    if (
      graduationYear !== null &&
      (!Number.isInteger(graduationYear) ||
        graduationYear < 1950 ||
        graduationYear > currentYear)
    ) {
      setErrorMessage(`سنة التخرج يجب أن تكون بين 1950 و ${currentYear}.`)
      return
    }

    setIsSaving(true)

    try {
      const updatedDoctor = await updateDoctorProfessionalProfile(doctor.id, {
        years_experience: yearsExperience,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        medical_school: form.medicalSchool.trim() || null,
        graduation_year: graduationYear,
        biography: form.biography.trim() || null,
        languages: textToArray(form.languages),
        previous_hospitals: textToArray(form.previousHospitals),
      })

      onDoctorChange(updatedDoctor)
      setSuccessMessage('تم حفظ الملف المهني بنجاح.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر حفظ الملف المهني. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-normal text-slate-950">
            الملف المهني
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            أضف معلوماتك المهنية ليتمكن المرضى من معرفة خبرتك قبل الحجز.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ الملف المهني'}
        </button>
      </div>

      {errorMessage ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="city">
            {'\u0627\u0644\u0645\u062F\u064A\u0646\u0629'}
          </label>
          <select
            id="city"
            value={form.city}
            onChange={(event) => updateForm('city', event.target.value)}
            className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
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

        <div className="grid gap-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="address">
            {'\u0627\u0644\u0639\u0646\u0648\u0627\u0646'}
          </label>
          <input
            id="address"
            type="text"
            value={form.address}
            onChange={(event) => updateForm('address', event.target.value)}
            className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
            placeholder={'\u0645\u062B\u0627\u0644: \u0634\u0627\u0631\u0639 \u0645\u062D\u0645\u062F \u0627\u0644\u062E\u0627\u0645\u0633\u060C \u062D\u064A \u0623\u0643\u062F\u0627\u0644'}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="yearsExperience">
            سنوات الخبرة
          </label>
          <input
            id="yearsExperience"
            type="number"
            min="0"
            value={form.yearsExperience}
            onChange={(event) => updateForm('yearsExperience', event.target.value)}
            className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="graduationYear">
            سنة التخرج
          </label>
          <input
            id="graduationYear"
            type="number"
            min="1950"
            max={new Date().getFullYear()}
            value={form.graduationYear}
            onChange={(event) => updateForm('graduationYear', event.target.value)}
            className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="medicalSchool">
            كلية الطب
          </label>
          <input
            id="medicalSchool"
            type="text"
            value={form.medicalSchool}
            onChange={(event) => updateForm('medicalSchool', event.target.value)}
            className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="biography">
            نبذة مهنية
          </label>
          <textarea
            id="biography"
            value={form.biography}
            onChange={(event) => updateForm('biography', event.target.value)}
            className="min-h-32 resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="languages">
            اللغات
          </label>
          <textarea
            id="languages"
            value={form.languages}
            onChange={(event) => updateForm('languages', event.target.value)}
            className="min-h-28 resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
            placeholder="العربية&#10;الفرنسية&#10;الإنجليزية"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold text-slate-800" htmlFor="previousHospitals">
            المستشفيات التي عمل بها سابقا
          </label>
          <textarea
            id="previousHospitals"
            value={form.previousHospitals}
            onChange={(event) =>
              updateForm('previousHospitals', event.target.value)
            }
            className="min-h-28 resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100"
          />
        </div>
      </div>
    </section>
  )
}
