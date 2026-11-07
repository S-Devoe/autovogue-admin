import { Check, X } from 'lucide-react'
import { Pill, StatusPill } from '@/components/common/status'
import { FileViewerButton } from '@/components/common/file-viewer'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AccountDoc } from '@/services/people/people.api'
import { useCan } from '@/hooks/use-can'
import { dateTime, titleCase } from '@/lib/format'

export function DocsTable({ docs, targetType }: { docs: AccountDoc[]; targetType: string }) {
  const { can } = useCan()
  if (!docs.length) return <p className="p-4 text-sm text-muted-foreground">No documents submitted.</p>
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Status</TableHead><TableHead>Match</TableHead><TableHead>Submitted</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {docs.map((d) => (
          <TableRow key={d.id}>
            <TableCell>{titleCase(d.documentType)}<p className="text-xs text-muted-foreground">{titleCase(d.verificationMode ?? 'manual')}</p></TableCell>
            <TableCell><StatusPill value={d.status} />{d.rejectionReason && <p className="mt-1 max-w-56 text-[11px] text-danger">{d.rejectionReason}</p>}</TableCell>
            <TableCell>
              {d.nameMatched == null ? <span className="text-xs text-muted-foreground">-</span> : (
                <Pill tone={d.nameMatched ? 'success' : 'danger'} dot={false}>{d.nameMatched ? <Check className="size-3" /> : <X className="size-3" />} Name</Pill>
              )}
            </TableCell>
            <TableCell className="text-xs">{dateTime(d.createdAt)}</TableCell>
            <TableCell className="text-right">{can('files.view_identity') && <FileViewerButton fileRef={d.documentUrl} purged={d.documentPurgedAt} target={{ type: targetType, id: d.id }} />}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
