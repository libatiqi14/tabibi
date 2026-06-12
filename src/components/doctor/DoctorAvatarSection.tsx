import { useState } from 'react'
import {
  uploadDoctorAvatar,
  type DoctorProfile,
} from '../../services/doctor'

type DoctorAvatarSectionProps = {
  doctor: DoctorProfile
  onDoctorChange: (doctor: DoctorProfile) => void
}

function getDoctorInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}

export function DoctorAvatar({
  doctor,
  size = 'lg',
}: {
  doctor: Pick<DoctorProfile, 'full_name' | 'avatar_url'>
  size?: 'md' | 'lg'
}) {
  const sizeClass = size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-16 w-16 text-lg'

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 font-bold text-teal-800 ring-1 ring-teal-100 ${sizeClass}`}
    >
      {doctor.avatar_url ? (
        <img
          src={doctor.avatar_url}
          alt={doctor.full_name}
          className="h-full w-full object-cover"
        />
      ) : (
        getDoctorInitials(doctor.full_name)
      )}
    </div>
  )
}

export default function DoctorAvatarSection({
  doctor,
  onDoctorChange,
}: DoctorAvatarSectionProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleFileChange = async (file: File | undefined) => {
    setErrorMessage('')
    setSuccessMessage('')

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('يرجى اختيار ملف صورة صالح.')
      return
    }

    setIsUploading(true)

    try {
      const updatedDoctor = await uploadDoctorAvatar(doctor.id, file)

      onDoctorChange(updatedDoctor)
      setSuccessMessage('تم تحديث الصورة الشخصية بنجاح.')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر رفع الصورة الشخصية. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <DoctorAvatar doctor={doctor} />

        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-normal text-slate-950">
            الصورة الشخصية للطبيب
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            ستظهر هذه الصورة للمرضى عند اختيار الطبيب وحجز الموعد.
          </p>

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-bold text-slate-800" htmlFor="doctorAvatar">
              الصورة الشخصية للطبيب
            </label>
            <input
              id="doctorAvatar"
              type="file"
              accept="image/*"
              onChange={(event) => void handleFileChange(event.target.files?.[0])}
              disabled={isUploading}
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:ml-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {errorMessage ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold leading-7 text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          {isUploading ? (
            <p className="mt-4 text-sm font-semibold text-teal-700">
              جاري رفع الصورة...
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
