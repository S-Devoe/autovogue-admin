import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArchiveRestore, Ban, Trash2 } from 'lucide-react'
import { KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { AuditTrail } from '@/components/common/record-panel'
import { Button } from '@/components/ui/button'
import { useListingAction, useRemovePhoto, useVehicle } from '@/services/listings/listings.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, naira, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/listings/$id')({ component: Listing })

function Listing() {
  const { id } = Route.useParams()
  const { can } = useCan()
  const q = useVehicle(id)
  const act = useListingAction()
  const removePhoto = useRemovePhoto()
  const [dialog, setDialog] = useState<'takedown' | 'restore' | { photoId: string } | null>(null)
  if (q.isLoading || !q.data) return <Rows n={8} />
  const v = q.data.vehicle
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Listings', to: '/listings' }]}
        title={<span className="flex flex-wrap items-center gap-3">{v.make} {v.model} {v.year} <StatusPill value={v.status} /> {v.takenDownAt && <Pill tone="danger">Taken down</Pill>}</span>}
        description={<><span className="font-mono">{v.licensePlate}</span> · <Link to="/people/vendors/$id" params={{ id: v.tenantId }} className="underline">{v.vendorName}</Link> · <Mono>{v.id}</Mono></>}
        actions={can('listings.takedown') && (v.takenDownAt
          ? <Button variant="outline" onClick={() => setDialog('restore')}><ArchiveRestore /> Restore listing</Button>
          : <Button variant="outline" className="text-danger" onClick={() => setDialog('takedown')}><Ban /> Take down</Button>)}
      />
      {v.takenDownAt && <div className="rise mb-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">Taken down {dateTime(v.takenDownAt)}: {v.takedownReason}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <Panel title="Photos" description="Remove a photo that breaks the rules. It is deleted from storage.">
            {q.data.photos.length === 0 ? <p className="text-sm text-muted-foreground">No photos.</p> : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {q.data.photos.map((p) => (
                  <div key={p.id} className="group relative overflow-hidden rounded-lg border">
                    <img src={p.photoUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    {p.isCover && <Pill tone="brand" className="absolute left-2 top-2">Cover</Pill>}
                    {can('listings.remove_photo') && (
                      <Button size="icon-sm" variant="destructive" className="absolute right-2 top-2 bg-danger text-white opacity-0 transition group-hover:opacity-100" onClick={() => setDialog({ photoId: p.id })} aria-label="Remove photo">
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Details">
            <KV cols={3} items={[
              ['Transmission', titleCase(v.transmission ?? '-')],
              ['Fuel', titleCase(v.primaryFuelType ?? '-')],
              ['Colour', v.color ?? '-'],
              ['Location', [v.locationAddress, v.locationState].filter(Boolean).join(', ') || '-'],
              ['Daily rate', v.customDailyRateKobo ? naira(v.customDailyRateKobo) : 'Pricing group'],
              ['Bookable', v.isBookable ? <Pill tone="success">Yes</Pill> : <Pill>No</Pill>],
              ['Instant book', v.isInstantBookable ? 'Yes' : 'Request'],
              ['Interstate', v.allowInterstateTravel ? 'Allowed' : 'No'],
              ['Rating', v.rating ? v.rating.toFixed(1) : '-'],
            ]} />
          </Panel>
        </div>
        <AuditTrail targetType="vehicle" targetId={id} />
      </div>
      <ReasonDialog open={dialog === 'takedown'} onOpenChange={(o) => !o && setDialog(null)} destructive title="Take this listing down" confirmLabel="Take down" pending={act.isPending}
        consequence="The car stops being bookable at once and leaves the marketplace. The vendor is notified with your reason."
        reasonLabel="Reason (shown to the vendor)"
        onConfirm={(reason) => act.mutateAsync({ id, action: 'takedown', reason }).then(() => setDialog(null))} />
      <ReasonDialog open={dialog === 'restore'} onOpenChange={(o) => !o && setDialog(null)} title="Restore this listing" confirmLabel="Restore" pending={act.isPending}
        consequence="If the car was on sale before and still qualifies (photos, pricing, documents), it goes back on sale."
        onConfirm={(reason) => act.mutateAsync({ id, action: 'restore', reason }).then(() => setDialog(null))} />
      {typeof dialog === 'object' && dialog && (
        <ReasonDialog open onOpenChange={(o) => !o && setDialog(null)} destructive title="Remove this photo" confirmLabel="Remove photo" pending={removePhoto.isPending}
          consequence="The photo is deleted from the listing and from storage. This can't be undone."
          onConfirm={(reason) => removePhoto.mutateAsync({ id, photoId: dialog.photoId, reason }).then(() => setDialog(null))} />
      )}
    </>
  )
}
