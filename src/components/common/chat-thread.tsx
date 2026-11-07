import type { ChatMessage } from '@/services/disputes/disputes.api'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** A booking chat, read only (opened from a dispute or a reported review). */
export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) return <p className="text-sm text-muted-foreground">No messages on this booking.</p>
  return (
    <ol className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
      {messages.map((m) => (
        <li key={m.id} className={cn('max-w-[80%] rounded-xl px-3 py-2 text-sm', m.sender === 'customer' ? 'justify-self-start bg-muted' : 'justify-self-end bg-info-soft')}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{m.sender === 'customer' ? 'User' : 'Vendor'} · {dateTime(m.createdAt)}</p>
          <p className="whitespace-pre-wrap">{m.body}</p>
        </li>
      ))}
    </ol>
  )
}
