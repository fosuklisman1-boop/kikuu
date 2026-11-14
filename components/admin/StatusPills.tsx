import { DELIVERY_LABELS, PAYMENT_LABELS, type DeliveryStatus, type PaymentStatus } from '@/lib/order-status'

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  refunded: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const DELIVERY_STYLE: Record<DeliveryStatus, string> = {
  processing: 'bg-sky-50 text-sky-800 ring-sky-200',
  shipped: 'bg-violet-50 text-violet-800 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap'

export function PaymentPill({ status }: { status: string }) {
  const s = (status in PAYMENT_STYLE ? status : 'pending') as PaymentStatus
  return <span className={`${base} ${PAYMENT_STYLE[s]}`}>{PAYMENT_LABELS[s]}</span>
}

export function DeliveryPill({ status }: { status: string | null }) {
  if (!status || !(status in DELIVERY_STYLE)) {
    return <span className={`${base} bg-slate-50 text-slate-500 ring-slate-200`}>Not started</span>
  }
  const s = status as DeliveryStatus
  return (
    <span className={`${base} ${DELIVERY_STYLE[s]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {DELIVERY_LABELS[s]}
    </span>
  )
}
