import { useEffect, useState } from 'react'
import { EyeIcon, FileLock2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ReasonDialog } from './reason-dialog'
import { openFile, type FileView } from '@/services/files/files.api'

/**
 * Opens a private document: asks for a reason (logged), fetches a 5-minute
 * signed link, and shows it in the page. No download button; the link is
 * never cached and is dropped when the viewer closes.
 */
export function FileViewerButton({ fileRef, label = 'View', target, size = 'sm', purged }: {
  fileRef?: string | null
  label?: string
  target?: { type: string; id: string }
  size?: 'sm' | 'xs' | 'default'
  purged?: string | null
}) {
  const [askReason, setAskReason] = useState(false)
  const [file, setFile] = useState<FileView | null>(null)
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (!file) return
    const t = setInterval(() => {
      const s = Math.floor((new Date(file.expiresAt).getTime() - Date.now()) / 1000)
      setLeft(s)
      if (s <= 0) setFile(null)
    }, 1000)
    return () => clearInterval(t)
  }, [file])

  if (purged) return <span className="text-xs text-muted-foreground">Deleted (retention)</span>
  if (!fileRef) return <span className="text-xs text-muted-foreground">No file</span>
  const isPublic = !fileRef.startsWith('private:')

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => (isPublic ? setFile({ url: fileRef, expiresAt: new Date(Date.now() + 3e5).toISOString(), contentType: 'image/jpeg' }) : setAskReason(true))}
      >
        {isPublic ? <EyeIcon /> : <FileLock2 />}
        {label}
      </Button>
      <ReasonDialog
        open={askReason}
        onOpenChange={setAskReason}
        title="Open a private document"
        consequence="This document is personal data. Opening it is logged with your name and reason. The link works for 5 minutes."
        confirmLabel="Open document"
        pending={busy}
        onConfirm={async (reason) => {
          setBusy(true)
          try {
            setFile(await openFile(fileRef, reason, target))
            setAskReason(false)
          } finally {
            setBusy(false)
          }
        }}
      />
      <Dialog open={!!file} onOpenChange={(o) => !o && setFile(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Document</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <Clock className="size-3.5" /> Link expires in {Math.max(0, Math.floor(left / 60))}:{String(Math.max(0, left % 60)).padStart(2, '0')}. Viewing only.
            </DialogDescription>
          </DialogHeader>
          {file && (
            <div className="grid max-h-[72vh] place-items-center overflow-auto rounded-lg bg-muted" onContextMenu={(e) => e.preventDefault()}>
              {file.contentType === 'application/pdf' ? (
                <iframe title="Document" src={`${file.url}#toolbar=0`} className="h-[70vh] w-full" referrerPolicy="no-referrer" />
              ) : (
                <img src={file.url} alt="Document" draggable={false} referrerPolicy="no-referrer" className="max-h-[70vh] w-auto select-none object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
