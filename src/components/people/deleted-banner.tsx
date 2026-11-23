import { dateOnly, dateTime } from '@/lib/format'

/**
 * Shown on a deleted account's profile. Bookings and money records stay;
 * personal details are wiped by the purge job after the retention period.
 */
export function DeletedBanner({ who, deletedAt, purgedAt, wipeDueAt }: { who: string; deletedAt: string; purgedAt: string | null; wipeDueAt?: string }) {
  return (
    <div role="status" className="rise mb-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <p className="font-medium">{who} deleted their account {dateTime(deletedAt)}.</p>
      <p className="mt-1 text-foreground/80">
        {purgedAt
          ? `Personal details were wiped ${dateOnly(purgedAt)}. Bookings and payments stay as records.`
          : `They can't sign in, and their email and phone are free to sign up again. Bookings and payments stay as records; personal details are wiped${wipeDueAt ? ` on ${dateOnly(wipeDueAt)}` : ' after the retention period'}.`}
      </p>
    </div>
  )
}
