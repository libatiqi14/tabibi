import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getPlatformStats,
  type PlatformStats as PlatformStatsData,
} from '../services/platformStats'

const emptyStats: PlatformStatsData = {
  totalDoctors: 0,
  totalPatients: 0,
  totalAppointments: 0,
  averageRating: 0,
}

function useCountUp(value: number, isVisible: boolean, decimals = 0) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      return undefined
    }

    const duration = 1100
    const startedAt = performance.now()
    let frameId = 0

    const animate = (currentTime: number) => {
      const progress = Math.min((currentTime - startedAt) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      setDisplayValue(value * easedProgress)

      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isVisible, value])

  return displayValue.toFixed(decimals)
}

function StatCard({
  icon,
  label,
  value,
  isVisible,
  decimals = 0,
}: {
  icon: string
  label: string
  value: number
  isVisible: boolean
  decimals?: number
}) {
  const animatedValue = useCountUp(value, isVisible, decimals)

  return (
    <article className="group rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-lg sm:p-6">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-3xl ring-1 ring-teal-100 transition group-hover:scale-105">
        {icon}
      </span>
      <p className="mt-5 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
        {animatedValue}
      </p>
      <p className="mt-2 text-sm font-bold text-slate-600">{label}</p>
    </article>
  )
}

export default function PlatformStats() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [stats, setStats] = useState<PlatformStatsData>(emptyStats)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      try {
        const data = await getPlatformStats()

        if (isMounted) {
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to load platform stats', error)

        if (isMounted) {
          setStats(emptyStats)
        }
      }
    }

    void loadStats()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current

    if (!section) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(section)

    return () => {
      observer.disconnect()
    }
  }, [])

  const cards = useMemo(
    () => [
      {
        icon: '👨‍⚕️',
        label: 'الأطباء',
        value: stats.totalDoctors,
      },
      {
        icon: '👥',
        label: 'المرضى',
        value: stats.totalPatients,
      },
      {
        icon: '📅',
        label: 'المواعيد',
        value: stats.totalAppointments,
      },
      {
        icon: '⭐',
        label: 'متوسط التقييم',
        value: stats.averageRating,
        decimals: 1,
      },
    ],
    [stats],
  )

  return (
    <section ref={sectionRef} aria-label="إحصائيات المنصة">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-black text-teal-700">أرقام حقيقية من المنصة</p>
        <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
          مجتمع طبي ينمو بثقة
        </h2>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            decimals={card.decimals ?? 0}
            isVisible={isVisible}
          />
        ))}
      </div>
    </section>
  )
}
