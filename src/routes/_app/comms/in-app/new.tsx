import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/common/page'
import { InAppEditor } from '@/components/comms/in-app-editor'

export const Route = createFileRoute('/_app/comms/in-app/new')({ component: NewInApp })

function NewInApp() {
  return (
    <>
      <PageHeader eyebrow="Comms" title="New in-app message" crumbs={[{ label: 'In-app messages', to: '/comms/in-app' }]} />
      <InAppEditor />
    </>
  )
}
