import { createFileRoute, Link } from '@tanstack/react-router'
import { Empty, PageHeader, Rows } from '@/components/common/page'
import { InAppEditor } from '@/components/comms/in-app-editor'
import { Button } from '@/components/ui/button'
import { rowsOf } from '@/services/request'
import { useInAppMessages, type InAppMessage } from '@/services/comms/in-app.api'

export const Route = createFileRoute('/_app/comms/in-app/$id')({ component: EditInApp })

function EditInApp() {
  const { id } = Route.useParams()
  const q = useInAppMessages()
  const m = rowsOf<InAppMessage>(q).find((r) => r.id === id)
  const header = <PageHeader eyebrow="Comms" title={m ? `Edit: ${m.title}` : 'Edit message'} crumbs={[{ label: 'In-app messages', to: '/comms/in-app' }]} />

  if (q.isLoading) return <>{header}<Rows /></>
  if (!m) {
    return (
      <>{header}
        <Empty title="Message not found" hint={<Button variant="outline" render={<Link to="/comms/in-app" />} nativeButton={false}>Back to the list</Button>} />
      </>
    )
  }
  if (m.status !== 'draft' && m.status !== 'paused') {
    return <>{header}<Empty title="Only a draft or paused message can be edited" hint="Pause it first from the list." /></>
  }
  return <>{header}<InAppEditor key={m.id} message={m} /></>
}
