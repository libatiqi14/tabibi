import type { ReactNode } from 'react'

type SectionToggleProps = {
  title: string
  description: string
  icon?: ReactNode
  open: boolean
  onClick: () => void
}

export default function SectionToggle({
  title,
  description,
  icon,
  open,
  onClick,
}: SectionToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
      aria-expanded={open}
    >
      <span className="flex items-start gap-4">
        {icon ? (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xl"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <span>
          <span className="block text-xl font-bold tracking-normal text-slate-950">
            {title}
          </span>
          <span className="mt-2 block text-sm leading-7 text-slate-600">
            {description}
          </span>
        </span>
      </span>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
        {open ? '⌃' : '⌄'}
      </span>
    </button>
  )
}
