import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
}

const variantClasses = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
