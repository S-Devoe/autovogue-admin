import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { naira } from '@/lib/format'

const toKobo = (text: string) => {
  const n = Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100)
  return Number.isFinite(n) ? n : 0
}

/**
 * Naira amount input that works in kobo underneath. It keeps what the person
 * typed (commas, a trailing point, "1500.5") and reports whole kobo; when
 * the amount is changed from outside (a "full amount" preset) it shows that.
 */
export function MoneyInput({ kobo, onChange, max, id }: { kobo: number; onChange: (k: number) => void; max?: number; id?: string }) {
  const [text, setText] = useState(kobo ? String(kobo / 100) : '')
  const reported = useRef(kobo)
  useEffect(() => {
    if (kobo !== reported.current) {
      reported.current = kobo
      setText(kobo ? String(kobo / 100) : '')
    }
  }, [kobo])
  return (
    <div className="grid gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
        <Input
          id={id}
          inputMode="decimal"
          className="pl-7 tabular"
          value={text}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9.,]/g, '')
            if ((t.match(/\./g) ?? []).length > 1) return // one decimal point
            if (/\.\d{3,}$/.test(t)) return // kobo has two places
            setText(t)
            const k = toKobo(t)
            reported.current = k
            onChange(k)
          }}
          placeholder="0.00"
        />
      </div>
      {max != null && <p className={`text-xs ${kobo > max ? 'font-medium text-danger' : 'text-muted-foreground'}`}>Up to {naira(max)}{kobo > max && ': this is more than allowed'}</p>}
    </div>
  )
}
