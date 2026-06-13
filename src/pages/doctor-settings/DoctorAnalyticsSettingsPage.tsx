import { useEffect, useState } from 'react'
import {
  getCurrentDoctor,
  type AppointmentStatus,
} from '../../services/doctor'
import {
  getDoctorAnalytics,
  type DoctorAnalytics,
} from '../../services/doctorAnalytics'
import DoctorSettingsLayout from './DoctorSettingsLayout'

const monthFormatter = new Intl.DateTimeFormat('ar-MA', {
  month: 'short',
  year: 'numeric',
})

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const statusClasses: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  confirmed: 'bg-teal-50 text-teal-800 ring-teal-600/20',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-600/20',
}

function getStatusLabel(status: AppointmentStatus) {
  return statusLabels[status]
}

function getStatusClass(status: AppointmentStatus) {
  return statusClasses[status]
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`
}

export default function DoctorAnalyticsSettingsPage() {
  const [analytics, setAnalytics] = useState<DoctorAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadAnalytics = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const doctor = await getCurrentDoctor()
        const result = await getDoctorAnalytics(doctor.id)

        if (isMounted) {
          setAnalytics(result)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الإحصائيات التفصيلية. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [])

  const maxMonthlyAppointments = Math.max(
    1,
    ...(analytics?.monthlyAppointments.map((month) => month.count) ?? [0]),
  )
  const maxRatingCount = Math.max(
    1,
    ...([1, 2, 3, 4, 5] as const).map(
      (rating) => analytics?.ratingDistribution[rating] ?? 0,
    ),
  )

  return (
    <DoctorSettingsLayout
      title="الإحصائيات التفصيلية"
      description="تابع أداء العيادة والمواعيد والتقييمات بشكل مفصل."
    >
      {errorMessage ? (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm">
          جاري تحميل الإحصائيات التفصيلية...
        </p>
      ) : analytics ? (
        <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">مواعيد اليوم</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {analytics.todayAppointments}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">
                مواعيد هذا الأسبوع
              </p>
              <p className="mt-2 text-2xl font-bold text-teal-700">
                {analytics.weekAppointments}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">مواعيد هذا الشهر</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {analytics.monthAppointments}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">
                مرضى جدد هذا الشهر
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {analytics.newPatientsThisMonth}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">معدل الإلغاء</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">
                {formatPercentage(analytics.cancelledRate)}
              </p>
            </article>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-slate-950">
                  المواعيد حسب الحالة
                </h2>
                <span className="text-sm font-semibold text-emerald-700">
                  معدل الإكمال {formatPercentage(analytics.completedRate)}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {(['scheduled', 'confirmed', 'completed', 'cancelled'] as const).map(
                  (status) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                    >
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${getStatusClass(
                          status,
                        )}`}
                      >
                        {getStatusLabel(status)}
                      </span>
                      <span className="text-lg font-bold text-slate-950">
                        {analytics.byStatus[status]}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="text-lg font-bold text-slate-950">
                توزيع التقييمات
              </h2>

              <div className="mt-4 grid gap-3">
                {([5, 4, 3, 2, 1] as const).map((rating) => {
                  const count = analytics.ratingDistribution[rating]
                  const width = `${(count / maxRatingCount) * 100}%`

                  return (
                    <div key={rating} className="grid gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-amber-600">
                          {'★'.repeat(rating)}
                          <span className="text-slate-300">
                            {'★'.repeat(5 - rating)}
                          </span>
                        </span>
                        <span className="font-bold text-slate-700">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-bold text-slate-950">
              المواعيد الشهرية خلال آخر 6 أشهر
            </h2>

            <div className="mt-4 grid gap-3">
              {analytics.monthlyAppointments.map((month) => {
                const monthDate = new Date(`${month.month}-01T00:00:00`)
                const width = `${(month.count / maxMonthlyAppointments) * 100}%`

                return (
                  <div
                    key={month.month}
                    className="grid gap-2 sm:grid-cols-[8rem_1fr_3rem] sm:items-center"
                  >
                    <span className="text-sm font-bold text-slate-700">
                      {monthFormatter.format(monthDate)}
                    </span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-600"
                        style={{ width }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-950">
                      {month.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        </section>
      ) : (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm">
          لا توجد إحصائيات متاحة حالياً
        </p>
      )}
    </DoctorSettingsLayout>
  )
}
