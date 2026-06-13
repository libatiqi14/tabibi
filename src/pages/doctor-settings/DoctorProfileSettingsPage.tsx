import { useEffect, useState } from 'react'
import DoctorProfessionalProfileSection from '../../components/doctor/DoctorProfessionalProfileSection'
import {
  getCurrentDoctor,
  type DoctorProfile,
} from '../../services/doctor'
import DoctorSettingsLayout from './DoctorSettingsLayout'

export default function DoctorProfileSettingsPage() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadDoctor = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const doctorProfile = await getCurrentDoctor()

        if (isMounted) {
          setDoctor(doctorProfile)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الملف المهني. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadDoctor()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <DoctorSettingsLayout
      title="الملف المهني"
      description="أضف معلوماتك المهنية ليراها المرضى عند اختيار الطبيب."
    >
      {errorMessage ? (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm">
          جاري تحميل الملف المهني...
        </p>
      ) : doctor ? (
        <DoctorProfessionalProfileSection doctor={doctor} onDoctorChange={setDoctor} />
      ) : null}
    </DoctorSettingsLayout>
  )
}
