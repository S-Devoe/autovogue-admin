import { useRefundQuote } from '@/services/bookings/bookings.api'
import { naira } from '@/lib/format'

/** Shows the Paystack fee users bear and what they actually receive. */
export function RefundQuoteLine({ bookingId, amountKobo, toWallet }: { bookingId: string; amountKobo: number; toWallet?: boolean }) {
  const q = useRefundQuote(bookingId, amountKobo, amountKobo > 0)
  if (!amountKobo) return null
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/50 p-3 text-sm tabular">
      <div className="flex justify-between"><span className="text-muted-foreground">Refund</span><span>{naira(amountKobo)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Paystack fee (borne by the user)</span><span>-{naira(q.data?.feeKobo ?? 0)}</span></div>
      <div className="flex justify-between border-t pt-1 font-semibold">
        <span>User receives {toWallet ? 'in their AutoVogue wallet' : ''}</span>
        <span>{q.isLoading ? '...' : naira(q.data?.netKobo ?? amountKobo)}</span>
      </div>
    </div>
  )
}
