import Link from 'next/link'
import type { ReactNode } from 'react'

// Shared building blocks so every admin page has the same header, surface and
// badge styling as the dashboard and orders pages.

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: { href: string; label: string } | ReactNode
}) {
  const isLink = action && typeof action === 'object' && 'href' in (action as object) && 'label' in (action as object)
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action &&
        (isLink ? (
          <Link
            href={(action as { href: string }).href}
            className="rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {(action as { label: string }).label}
          </Link>
        ) : (
          (action as ReactNode)
        ))}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <h2 className="text-sm font-semibold text-slate-900">{children}</h2>
      {action}
    </div>
  )
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
} as const

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && (
        <Link href={action.href} className="mt-4 inline-block rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Table class names reused across list pages.
export const TH = 'px-4 py-3 text-left text-xs font-medium text-slate-500'
export const THR = 'px-4 py-3 text-right text-xs font-medium text-slate-500'
export const TD = 'px-4 py-3'
export const ROW = 'hover:bg-slate-50/70'
export const THEAD = 'border-b border-slate-200'
export const TBODY = 'divide-y divide-slate-100'
export const LINK = 'text-sm font-medium text-emerald-800 hover:underline'
