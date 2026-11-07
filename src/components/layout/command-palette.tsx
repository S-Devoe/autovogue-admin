import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CalendarRange, Car, CornerDownLeft, User, Building2 } from 'lucide-react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { NAV } from './nav'
import { useCan } from '@/hooks/use-can'

/** ⌘K: jump to a page, or search bookings, people and plates. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { can } = useCan()
  const go = (to: string, search?: Record<string, string>) => {
    onOpenChange(false)
    setQ('')
    navigate({ to, search: search as never })
  }
  const pages = NAV.flatMap((n) => (n.children ? n.children.map((c) => ({ ...c, group: n.label, perms: c.perms ?? n.perms })) : [{ label: n.label, to: n.to, group: 'Pages', perms: n.perms }]))
    .filter((p) => !p.perms || can(...p.perms))
  const term = q.trim()

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Find a booking, person, plate or page">
      <Command>
      <CommandInput placeholder="Booking reference, email, phone, plate or page..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No pages match. Press Enter on a search below.</CommandEmpty>
        <CommandGroup heading="Go to">
          {pages.map((p) => (
            <CommandItem key={p.to} value={`${p.group} ${p.label}`} onSelect={() => go(p.to)}>
              <span className="text-muted-foreground">{p.group === 'Pages' ? '' : `${p.group} / `}</span>
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        {term && (
          <CommandGroup heading={`Search "${term}"`}>
            {can('bookings.view') && (
              <CommandItem value={`search-bookings ${term}`} onSelect={() => go('/bookings', { q: term })}>
                <CalendarRange /> Bookings matching "{term}" <CornerDownLeft className="ml-auto opacity-50" />
              </CommandItem>
            )}
            {can('accounts.view') && (
              <>
                <CommandItem value={`search-users ${term}`} onSelect={() => go('/people/users', { q: term })}>
                  <User /> Users matching "{term}"
                </CommandItem>
                <CommandItem value={`search-vendors ${term}`} onSelect={() => go('/people/vendors', { q: term })}>
                  <Building2 /> Vendors matching "{term}"
                </CommandItem>
              </>
            )}
            {can('listings.view') && (
              <CommandItem value={`search-listings ${term}`} onSelect={() => go('/listings', { q: term })}>
                <Car /> Listings matching "{term}"
              </CommandItem>
            )}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
