import { createFileRoute } from '@tanstack/react-router'
import { Empty, PageHeader, Panel, Rows, usePager } from '@/components/common/page'
import { useRefunds } from '@/services/money/money.api'
import { EventsTable } from './payments'

export const Route = createFileRoute('/_app/money/refunds')({ component: Refunds })

function Refunds() {
  const q = useRefunds()
  const { rows: rows, pager: qPager } = usePager(q)
  return (
    <>
      <PageHeader eyebrow="Money" title="Refunds" description="Refunds started by staff or by dispute outcomes. Start a refund from the booking page." />
      <Panel flush>
        {q.isLoading ? <Rows /> : rows.length === 0 ? <Empty title="No refunds yet" /> : <EventsTable rows={rows} />}
        {qPager}
      </Panel>
    </>
  )
}
