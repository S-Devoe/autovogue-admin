import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Empty, Filters, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { Pill } from '@/components/common/status'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useExpiringDocs, useRemindVendor } from '@/services/verification/verification.api'
import { Button } from '@/components/ui/button'
import { useCan } from '@/hooks/use-can'
import { dateOnly, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/verification/expiring')({ component: Expiring })

function Expiring() {
  const [days, setDays] = useState(30)
  const q = useExpiringDocs(days)
  const { rows: qRows, pager: qPager } = usePager(q)
  const remind = useRemindVendor()
  const { can } = useCan()
  return (
    <>
      <PageHeader eyebrow="Verification" title="Expiring documents" description="Insurance, roadworthiness and ownership documents that expire soon. An hourly job marks expired ones and takes the car off the marketplace until a new one is approved." />
      <Panel flush>
        <Filters>
          <NativeSelect aria-label="Expiring within" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
            {[7, 14, 30, 60, 90].map((d) => <NativeSelectOption key={d} value={d}>Next {d} days</NativeSelectOption>)}
          </NativeSelect>
        </Filters>
        {q.isLoading ? <Rows /> : !qRows.length ? <Empty title="Nothing expiring in this window" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Vendor</TableHead><TableHead>Document</TableHead><TableHead>Expires</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {qRows.map((d) => {
                const daysLeft = Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 864e5)
                return (
                  <TableRow key={d.id}>
                    <TableCell><Link to="/listings/$id" params={{ id: d.vehicleId }} className="font-medium hover:underline">{d.make} {d.model}</Link><p className="font-mono text-xs text-muted-foreground">{d.licensePlate}</p></TableCell>
                    <TableCell><Link to="/people/vendors/$id" params={{ id: d.tenantId }} className="hover:underline">{d.vendorName}</Link></TableCell>
                    <TableCell>{titleCase(d.documentType)}</TableCell>
                    <TableCell>
                      {dateOnly(d.expiresAt)}{' '}
                      <Pill tone={daysLeft < 0 ? 'danger' : daysLeft <= 7 ? 'warning' : 'neutral'}>{daysLeft < 0 ? 'Expired' : `${daysLeft}d`}</Pill>
                    </TableCell>
                    <TableCell className="text-right">{can('verifications.decide') && <Button size="sm" variant="outline" onClick={() => remind.mutate(d.id)}>Remind vendor</Button>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {qPager}
      </Panel>
    </>
  )
}
