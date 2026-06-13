import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

type StatCardProps = {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: 'slate' | 'teal' | 'emerald' | 'amber' | 'rose'
}

type EmptyStateProps = {
  title: string
  description?: string
}

type StatusBadgeProps = {
  children: ReactNode
  tone?: 'slate' | 'teal' | 'emerald' | 'amber' | 'rose'
}

type AvatarProps = {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const toneClasses = {
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200',
}

const statToneClasses = {
  slate: 'text-slate-950',
  teal: 'text-teal-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-600',
  rose: 'text-rose-700',
}

const avatarSizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-base',
  lg: 'h-20 w-20 text-xl',
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'slate',
}: StatCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {label}
      </p>
      <p className={`mt-3 text-3xl font-bold ${statToneClasses[tone]}`}>
        {value}
      </p>
    </article>
  )
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
      ) : null}
    </div>
  )
}

export function StatusBadge({ children, tone = 'slate' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 font-bold text-teal-800 ring-1 ring-teal-100 ${avatarSizeClasses[size]}`}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}
