/** Money is integer kobo everywhere; format only for display (₦12,500.00). */
const ngn = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
export const naira = (kobo?: number | null) => (kobo == null ? '-' : ngn.format(kobo / 100))

const WAT = 'Africa/Lagos'
const dt = new Intl.DateTimeFormat('en-NG', { timeZone: WAT, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const d = new Intl.DateTimeFormat('en-NG', { timeZone: WAT, day: '2-digit', month: 'short', year: 'numeric' })

/** Date and time in WAT, e.g. "07 Nov 2026, 14:05". */
export const dateTime = (v?: string | null) => (v ? dt.format(new Date(v)) : '-')
export const dateOnly = (v?: string | null) => (v ? d.format(new Date(v)) : '-')

/** Compact age: "4m", "3h 12m", "2d 4h". */
export function age(from?: string | null, to: Date = new Date()) {
  if (!from) return '-'
  let s = Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 1000))
  const days = Math.floor(s / 86400)
  s -= days * 86400
  const h = Math.floor(s / 3600)
  const m = Math.floor((s - h * 3600) / 60)
  if (days) return `${days}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

/** Time left as "+5h 10m" (remaining) or "-2h" (overdue). */
export function timeLeft(secondsLeft: number) {
  const neg = secondsLeft < 0
  const s = Math.abs(secondsLeft)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`
  return neg ? `${txt} over` : `${txt} left`
}

export const shortId = (id?: string | null) => (id ? id.slice(-8) : '-')

export const titleCase = (s?: unknown) =>
  (typeof s === 'string' ? s : s == null ? '' : String(s)).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const bps = (v?: number | null) => (v == null ? '-' : `${(v / 100).toFixed(2)}%`)
