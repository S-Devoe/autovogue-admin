import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Percent } from 'lucide-react'
import { KV, Mono, PageHeader, Panel, Rows } from '@/components/common/page'
import { Pill, StatusPill } from '@/components/common/status'
import { ReasonDialog } from '@/components/common/reason-dialog'
import { AuditTrail, NotesPanel } from '@/components/common/record-panel'
import { AccountActions } from '@/components/people/account-actions'
import { DocsTable } from '@/components/people/docs-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProposeCommission, useSettlementDecision, useTenant, useVendorStaffDisable } from '@/services/people/people.api'
import { useAddNote } from '@/services/bookings/bookings.api'
import { API_ENDPOINTS } from '@/services/api-endpoints'
import { QUERY_KEYS } from '@/services/query.keys'
import { useCan } from '@/hooks/use-can'
import { bps, dateOnly, dateTime, naira, shortId, titleCase } from '@/lib/format'

export const Route = createFileRoute('/_app/people/vendors/$id')({ component: Vendor })

function Vendor() {
  const { id } = Route.useParams()
  const { can } = useCan()
  const [reveal, setReveal] = useState<{ reason: string } | undefined>()
  const q = useTenant(id, reveal)
  const note = useAddNote((x) => API_ENDPOINTS.accountAction('tenants', x, 'notes'), [QUERY_KEYS.TENANT])
  const commission = useProposeCommission()
  const staffDisable = useVendorStaffDisable()
  const settlement = useSettlementDecision()
  const [accepting, setAccepting] = useState(false)
  const [dialog, setDialog] = useState<'reveal' | 'commission' | { staffId: string; disabled: boolean; name: string } | null>(null)
  const [newBps, setNewBps] = useState('')

  if (q.isLoading || !q.data) return <Rows n={10} />
  const { tenant: t } = q.data
  const suspended = t.status === 'suspended'

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Vendors', to: '/people/vendors' }]}
        title={<span className="flex flex-wrap items-center gap-3">{t.name} <StatusPill value={t.status} /> {t.isVerified ? <Pill tone="success">Verified</Pill> : <Pill tone="warning">Not verified</Pill>}</span>}
        description={<>{titleCase(t.tenantType)} · joined {dateOnly(t.createdAt)} · <Mono>{t.id}</Mono></>}
        actions={<AccountActions kind="tenants" id={id} suspended={suspended} openBookings={q.data.openBookings.length} />}
      />
      {suspended && <div className="rise mb-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">Suspended {dateTime(t.suspendedAt)}: {t.suspendReason}. Their cars are hidden from the marketplace.</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <Panel title="Business">
            <KV cols={3} items={[
              ['Phone', <span className="font-mono">{t.phone || '-'}</span>],
              ['Address', t.address || '-'],
              ['KYC/KYB', titleCase(t.verificationStatus || 'unverified')],
              ['Bookings', t.bookingCount], ['Cars', q.data.vehicles.length],
              ['Commission override', t.commissionBps ? bps(t.commissionBps) : 'Platform default'],
            ]} />
          </Panel>

          <Panel
            title="Settlement account"
            description="Payouts only go to an account whose name matches the verified legal (or CAC) name."
            actions={can('settlement.reveal') && !reveal && <Button size="sm" variant="outline" onClick={() => setDialog('reveal')}><Eye /> Reveal number</Button>}
          >
            <KV cols={2} items={[
              ['Bank', t.settlementBankName || 'Not set'],
              ['Account number', <span className="font-mono">{t.settlementAccountNumber || '-'}</span>],
              ['Account name (from Paystack)', t.settlementAccountName || '-'],
              ['Verified legal name', q.data.verifiedLegalName ?? <span className="text-muted-foreground">Not verified</span>],
              ['Match', q.data.settlementNameMatches == null ? '-' : q.data.settlementNameMatches ? <Pill tone="success">Names match</Pill> : <Pill tone="danger">Names differ: payouts blocked</Pill>],
            ]} />
            {q.data.settlementNameMatches === false && can('settlement.decide') && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
                <span>If you've checked this account belongs to the vendor (for example a registered trading name), you can accept it for payouts.</span>
                <Button size="sm" variant="outline" onClick={() => setAccepting(true)}>Accept this account</Button>
              </div>
            )}
          </Panel>

          <Tabs defaultValue="docs">
            <TabsList>
              <TabsTrigger value="docs">Documents</TabsTrigger>
              <TabsTrigger value="cars">Cars</TabsTrigger>
              <TabsTrigger value="staff">Staff and drivers</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>
            <TabsContent value="docs"><Panel flush><DocsTable docs={q.data.documents} targetType="tenant_document" /></Panel></TabsContent>
            <TabsContent value="cars">
              <Panel flush>
                <Table>
                  <TableHeader><TableRow><TableHead>Car</TableHead><TableHead>Plate</TableHead><TableHead>Status</TableHead><TableHead>Bookable</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {q.data.vehicles.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell><Link to="/listings/$id" params={{ id: v.id }} className="font-medium hover:underline">{v.make} {v.model} {v.year}</Link></TableCell>
                        <TableCell className="font-mono text-xs">{v.licensePlate}</TableCell>
                        <TableCell><StatusPill value={v.status} />{v.takenDownAt && <Pill tone="danger" className="ml-1">Taken down</Pill>}</TableCell>
                        <TableCell>{v.isBookable ? <Pill tone="success">Yes</Pill> : <Pill>No</Pill>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
            <TabsContent value="staff">
              <Panel flush>
                <Table>
                  <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Role</TableHead><TableHead>Last sign-in</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {q.data.staff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.fullName}<p className="text-xs text-muted-foreground">{s.email}</p></TableCell>
                        <TableCell>{titleCase(s.role ?? '')}</TableCell>
                        <TableCell className="text-xs">{dateTime(s.lastLoginAt)}</TableCell>
                        <TableCell>{s.disabledByPlatformAt ? <Pill tone="danger">Disabled by AutoVogue</Pill> : s.isBlocked ? <Pill tone="danger">Blocked</Pill> : <Pill tone="success">Active</Pill>}</TableCell>
                        <TableCell className="text-right">
                          {can('accounts.suspend') && (
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ staffId: s.id, disabled: !s.disabledByPlatformAt, name: s.fullName })}>
                              {s.disabledByPlatformAt ? 'Enable' : 'Disable'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {q.data.drivers.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.fullName}<p className="text-xs text-muted-foreground">Driver</p></TableCell>
                        <TableCell>Driver</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell><StatusPill value={d.verificationStatus === 'VERIFIED' ? 'verified' : d.verificationStatus === 'SUSPENDED' ? 'suspended' : 'pending'} label={titleCase(d.verificationStatus)} /></TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
            <TabsContent value="bookings">
              <Panel flush>
                <Table>
                  <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>User</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {q.data.recentBookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell><Link to="/bookings/$id" params={{ id: b.id }} className="hover:underline"><Mono>{shortId(b.id)}</Mono></Link></TableCell>
                        <TableCell>{b.customerName}</TableCell>
                        <TableCell className="text-xs">{dateTime(b.startTime)}</TableCell>
                        <TableCell><StatusPill value={b.status} /></TableCell>
                        <TableCell className="text-right tabular">{naira(b.totalInvoiceKobo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
            <TabsContent value="payouts">
              <Panel flush>
                <Table>
                  <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>State</TableHead><TableHead>Paid</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {q.data.payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell><Link to="/bookings/$id" params={{ id: p.id }} className="hover:underline"><Mono>{shortId(p.id)}</Mono></Link></TableCell>
                        <TableCell><StatusPill value={p.fundState} /></TableCell>
                        <TableCell className="text-xs">{dateTime(p.payoutReleasedAt)}</TableCell>
                        <TableCell className="text-right tabular">{naira(p.vendorPayoutKobo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>
        <div className="grid content-start gap-5">
          {can('commission.propose') && (
            <Panel title="Commission" description="Overrides need a second approver and apply to bookings created after approval.">
              <p className="font-display text-2xl font-semibold">{t.commissionBps ? bps(t.commissionBps) : 'Default'}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => { setNewBps(t.commissionBps ? String(t.commissionBps) : ''); setDialog('commission') }}><Percent /> Propose change</Button>
            </Panel>
          )}
          <NotesPanel notes={q.data.notes} canAdd={can('accounts.notes')} pending={note.isPending} onAdd={(body) => note.mutateAsync({ id, body })} />
          <AuditTrail targetType="tenant" targetId={id} />
        </div>
      </div>

      <ReasonDialog open={accepting} onOpenChange={setAccepting} title="Accept a mismatched settlement account" confirmLabel="Accept for payouts" pending={settlement.isPending}
        consequence="Payouts go to this exact account even though its name differs from the verified name. If the vendor changes the account, the check applies again."
        onConfirm={(reason) => settlement.mutateAsync({ id, accept: true, reason }).then(() => setAccepting(false))} />
      <ReasonDialog open={dialog === 'reveal'} onOpenChange={(o) => !o && setDialog(null)} title="Reveal the full account number" confirmLabel="Reveal"
        consequence="The full number is shown on this screen only. The reveal is logged with your reason."
        onConfirm={(reason) => { setReveal({ reason }); setDialog(null) }} />
      <ReasonDialog open={dialog === 'commission'} onOpenChange={(o) => !o && setDialog(null)} title="Propose a commission override" confirmLabel="Send for approval" pending={commission.isPending}
        canConfirm={newBps === '' || (Number(newBps) >= 0 && Number(newBps) <= 3000)}
        consequence="A different person with config.approve must approve it. Total commission is split 30% user / 70% vendor by the pricing engine."
        onConfirm={(reason) => commission.mutateAsync({ id, bps: newBps === '' ? null : Number(newBps), reason }).then(() => setDialog(null))}>
        <Field>
          <FieldLabel>Total commission (basis points)</FieldLabel>
          <Input value={newBps} onChange={(e) => setNewBps(e.target.value.replace(/\D/g, ''))} placeholder="Empty = platform default" inputMode="numeric" />
          <FieldDescription>{newBps ? `${bps(Number(newBps))} total` : 'Clears the override'}. 100 bps = 1%.</FieldDescription>
        </Field>
      </ReasonDialog>
      {typeof dialog === 'object' && dialog && (
        <ReasonDialog open onOpenChange={(o) => !o && setDialog(null)} title={`${dialog.disabled ? 'Disable' : 'Enable'} ${dialog.name}`} destructive={dialog.disabled} confirmLabel={dialog.disabled ? 'Disable' : 'Enable'} pending={staffDisable.isPending}
          consequence={dialog.disabled ? 'They are signed out and cannot sign in to the vendor dashboard.' : 'They can sign in to the vendor dashboard again.'}
          onConfirm={(reason) => staffDisable.mutateAsync({ tenantId: id, staffId: dialog.staffId, disabled: dialog.disabled, reason }).then(() => setDialog(null))} />
      )}
    </>
  )
}
