import {
  Banknote, BadgeCheck, ChartColumn, CalendarRange, Car, Gauge, Gavel, Megaphone, Settings2, ShieldAlert, Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Any one of these permissions shows the item. */
  perms?: string[]
  badge?: string
  children?: { label: string; to: string; perms?: string[] }[]
}

/** Sidebar sections (PRD section 4). */
export const NAV: NavItem[] = [
  { label: 'Overview', to: '/', icon: Gauge },
  {
    label: 'Verification', to: '/verification/users', icon: BadgeCheck, perms: ['verifications.view'], badge: 'verification',
    children: [
      { label: 'Users', to: '/verification/users' },
      { label: 'Hosts', to: '/verification/hosts' },
      { label: 'Fleet partners', to: '/verification/fleet' },
      { label: 'Drivers', to: '/verification/drivers' },
      { label: 'Vehicles', to: '/verification/vehicles' },
      { label: 'Prembly checks', to: '/verification/pending-checks' },
      { label: 'Expiring', to: '/verification/expiring' },
      { label: 'Name changes', to: '/verification/name-changes' },
    ],
  },
  { label: 'Bookings', to: '/bookings', icon: CalendarRange, perms: ['bookings.view'], badge: 'bookings' },
  {
    label: 'Money', to: '/money/payouts', icon: Banknote, perms: ['payments.view', 'payouts.view', 'wallets.view'], badge: 'money',
    children: [
      { label: 'Payouts', to: '/money/payouts', perms: ['payouts.view'] },
      { label: 'Payments', to: '/money/payments', perms: ['payments.view'] },
      { label: 'Refunds', to: '/money/refunds', perms: ['payouts.view'] },
      { label: 'Reconciliation', to: '/money/reconciliation', perms: ['payments.view'] },
      { label: 'Wallets', to: '/money/wallets', perms: ['wallets.view'] },
      { label: 'Commission ledger', to: '/money/ledger', perms: ['payments.view'] },
    ],
  },
  { label: 'Disputes', to: '/disputes', icon: Gavel, perms: ['disputes.view'], badge: 'disputes' },
  {
    label: 'People', to: '/people/users', icon: Users, perms: ['accounts.view'],
    children: [
      { label: 'Users', to: '/people/users' },
      { label: 'Vendors', to: '/people/vendors' },
      { label: 'Waitlist', to: '/people/waitlist' },
    ],
  },
  { label: 'Listings', to: '/listings', icon: Car, perms: ['listings.view'] },
  { label: 'Trust', to: '/trust/reviews', icon: ShieldAlert, perms: ['reviews.moderate'], badge: 'trust' },
  { label: 'Reports', to: '/reports', icon: ChartColumn, perms: ['payments.view', 'bookings.view'] },
  {
    label: 'Comms', to: '/comms/email', icon: Megaphone, perms: ['broadcasts.draft'],
    children: [
      { label: 'Email campaigns', to: '/comms/email' },
      { label: 'Push campaigns', to: '/comms/push' },
    ],
  },
  {
    label: 'Settings', to: '/settings/platform', icon: Settings2, badge: 'settings',
    children: [
      { label: 'Platform', to: '/settings/platform', perms: ['config.view'] },
      { label: 'Approvals', to: '/settings/approvals', perms: ['config.view', 'config.approve', 'money.approve', 'roles.manage', 'accounts.suspend'] },
      { label: 'Staff', to: '/settings/staff', perms: ['staff.view'] },
      { label: 'Roles', to: '/settings/roles', perms: ['roles.view'] },
      { label: 'Audit log', to: '/settings/audit', perms: ['audit.view_own', 'audit.view_all'] },
      { label: 'Content', to: '/settings/content', perms: ['config.view'] },
      { label: 'Access review', to: '/settings/access-review', perms: ['roles.manage'] },
      { label: 'Data retention', to: '/settings/retention', perms: ['dsr.view', 'dsr.log', 'breaches.manage', 'audit.view_all'] },
      { label: 'Privacy (NDPR)', to: '/settings/privacy', perms: ['dsr.view', 'dsr.log', 'breaches.manage'] },
      { label: 'My account', to: '/settings/account' },
    ],
  },
]
