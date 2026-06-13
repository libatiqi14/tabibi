import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export default function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-100 ${className}`}
      {...props}
    />
  )
}
