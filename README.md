# AutoVogue Admin

The internal web app AutoVogue staff use to keep the marketplace safe and the money correct: verify identities and businesses, watch unpaid and failed payments, resolve disputes, move and repair money, moderate listings and reviews, change platform settings, and keep the NDPR registers. Every action is permission-checked and logged by the API.

- Production: `admin.autovogue.app` (talks to `api.autovogue.app`)
- Staging: `staging-admin.autovogue.app` (talks to `staging-api.autovogue.app`, amber STAGING bar)
- Local: `http://localhost:3300` (talks to `http://localhost:4000`)

## Stack

- TanStack Start in **SPA mode** (static build, no server of our own), TanStack Router (file routes in `src/routes`) and TanStack Query
- shadcn/ui on **Base UI**, installed with the shadcn CLI (`pnpm dlx shadcn@latest add <name>`); do not hand-write `src/components/ui`
- Tailwind CSS 4, theme tokens in `src/styles.css` (light and dark), Fraunces + Plus Jakarta Sans (the vendor dashboard's fonts)
- axios with cookie credentials (`src/services/axios-api.ts`)

## Run it

```bash
pnpm install
cp .env.example .env.local     # VITE_API_BASE_URL + VITE_ENV
pnpm dev                       # http://localhost:3300
```

The API must allow the origin: set `ADMIN_DASHBOARD_URL=http://localhost:3300` in the API's `.env`, plus `PLATFORM_TOTP_ENC_KEY` (`openssl rand -base64 32`). Without that key nobody can set up 2FA, so nobody can sign in.

Builds: `pnpm build:staging`, `pnpm build:production` (they read `.env.staging` / `.env.production`), `pnpm build:local` (reads `.env.local`). Output is `dist/client`.

## Hosting (any static host)

The build is plain static files, so it runs on Vercel, Netlify, Cloudflare Pages, S3 + CloudFront, nginx or anything else:

- Serve `dist/client`; every path that isn't a file falls back to `_shell.html`.
- The **Content-Security-Policy is inside the page** as a `<meta>` tag, written after the build by `scripts/csp.mjs` with a sha256 hash of each inline script (no `'unsafe-inline'` for scripts). `connect-src` allows only the API in `VITE_API_BASE_URL`.
- The host must still send the headers a meta tag can't: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS. `scripts/serve-static.mjs` (a tiny Node server, `node scripts/serve-static.mjs`, port 3301) shows the full set; `vercel.json` has the same for Vercel.
- Cache `assets/*` forever; never cache `_shell.html`.

## Signing in

1. Email and password, then a 6-digit code from an authenticator app (no SMS).
2. First sign-in (or after an invite): scan the QR code, enter a code, then save the 10 recovery codes (shown once).
3. The session is one HttpOnly cookie (`avp_session`, SameSite=Strict) set by the API. It ends after 30 minutes idle or 12 hours. Writes carry `X-CSRF-Token` from `/auth/platform/me`.
4. Sensitive actions (money, roles, settings approvals, kill switches) need a code entered in the last 10 minutes. The API answers `STEP_UP_REQUIRED`; the app asks for a code and retries the same request automatically.

New staff are invited from Settings, Staff. The first two super admins are created on the API server with the `platform-staff` CLI (see the API README).

## How the code is laid out

```
src/routes/            file routes; _app.tsx guards every signed-in screen
src/routes/_app/       overview, verification (incl. name changes), bookings, money,
                       disputes, people (users, vendors, waitlist), listings, trust, reports,
                       comms (email campaigns, push campaigns), settings
                       (platform, approvals, staff, roles, audit, content,
                       access review, data retention, privacy, account)
src/services/          one folder per area: <area>.api.ts holds types + React Query hooks
src/services/query.keys.ts     every query key (QUERY_KEYS object)
src/services/api-endpoints.ts  every API path
src/services/request.ts        get(), send() and useAdminMutation()
src/components/common/ ReasonDialog, FileViewerButton, NotesPanel, AuditTrail, status pills
src/components/layout/ app shell, navigation (nav.ts), command palette (Cmd/Ctrl+K)
src/hooks/use-can.ts   permission checks for hiding UI
```

## Service charges, explained simply

### Where to change them

Go to **Settings > Platform**. Find the row you want and click **Change**. Type the new number and a reason, then click **Send for approval**. Another staff member must approve it in **Settings > Approvals** (you can't approve your own change). After that, the API starts using the new number within a minute. Every change is listed in the **History** panel on the same page.

### What "bps" means

Imagine a pizza cut into 100 slices. One slice is **1 percent** (1%).

Now imagine each of those slices is cut into 100 tiny crumbs. One crumb is **1 basis point**, written **1 bps**.

So:

- 1 bps is one tiny crumb (0.01%)
- 100 bps is one whole slice (1%)
- 300 bps is three slices (3%)
- 700 bps is seven slices (7%)
- 3000 bps is thirty slices (30%), the biggest number the page accepts

**To turn a percent into bps, multiply by 100.** 2.5% becomes 250 bps. **To turn bps into a percent, divide by 100.** 450 bps becomes 4.5%.

Why crumbs and not slices? Computers are bad at numbers with dots in them (like 2.5), and tiny rounding mistakes add up when the numbers are money. Whole numbers like 250 never get rounded wrong.

### Two charges, not one

Every booking has **two** service charges:

1. **The renter/user fee** (rows called "Renter/User fee" on the page). The renter is the person using the AutoVogue app to rent a car. They pay this fee **on top of** the rental price.
2. **The vendor commission** (rows called "Vendor commission"). It is **taken out of** the vendor's share.

Think of a lemonade stand that sells through us. The buyer pays a little extra to us, and the lemonade seller gives us a little of what they earn. We keep both bits.

### Which number gets used

The page has a renter/user fee and a vendor commission for each kind of vendor, plus a backup pair:

| Row on the page | Key | Used for |
|---|---|---|
| Renter/User fee: fleet partner cars | `commission.fleet_partner.customer_bps` | renters booking a business's (fleet partner's) car |
| Vendor commission: fleet partners | `commission.fleet_partner.vendor_bps` | fleet partners |
| Renter/User fee: individual host cars | `commission.individual_host.customer_bps` | renters booking an individual host's car |
| Vendor commission: individual hosts | `commission.individual_host.vendor_bps` | individual hosts |
| Renter/User fee: general fallback | `commission.customer_bps` | backup when a vendor type has no number of its own |
| Vendor commission: general fallback | `commission.vendor_bps` | backup when a vendor type has no number of its own |

The API checks in this order and stops at the first one it finds:

1. **A special rate for this one vendor** (set on the vendor's page under People > Vendors, also needs a second approver). This is a single total number that the API splits: 30% of it becomes the renter/user fee and 70% becomes the vendor commission. For example, 1000 bps becomes a 300 bps renter/user fee and a 700 bps vendor commission.
2. **The rate for the vendor's type** (fleet partner or individual host).
3. **The general fallback rate.**
4. **The built-in default:** 300 bps (3%) renter/user fee and 700 bps (7%) vendor commission.

Every booking remembers the rates it was made with. Changing a rate only affects **new** bookings, never ones already paid.

### VAT sits on top of our charges

The government takes **7.5% VAT on our service charges** (not on the rental price). That VAT is added to each charge.

### A full example

A renter (app user) books a car whose rental price is **₦20,000**, with the default rates (300 bps renter/user fee, 700 bps vendor commission):

**What the renter/user pays**

| | |
|---|---|
| Rental price | ₦20,000.00 |
| Renter/user fee: 3% of ₦20,000 | ₦600.00 |
| VAT on the renter/user fee: 7.5% of ₦600 | ₦45.00 |
| **Total, before any caution fee** | **₦20,645.00** |

**What the vendor gets**

| | |
|---|---|
| Rental price | ₦20,000.00 |
| Vendor commission: 7% of ₦20,000 | minus ₦1,400.00 |
| VAT on the commission: 7.5% of ₦1,400 | minus ₦105.00 |
| **Vendor's share** | **₦18,495.00** |

**What AutoVogue keeps:** ₦600 + ₦1,400 = ₦2,000 in charges. The ₦150 VAT (₦45 + ₦105) belongs to the government, not to us.

The caution fee is extra money the user pays as a promise to bring the car back safely. It is not a service charge, and the user gets it back in their wallet unless there is a dispute (see **Trips, explained simply** for when).

Vendors only ever see the rental price, their commission percentage and their share. They never see the renter/user fee or VAT.

## Verification, explained simply

### Two ways a document gets checked

Think of a school checking that you really are who you say you are.

1. **The robot check (Prembly).** You tell the robot your ID number. It looks it up in the government's records and says "yes, the name matches" or "no, it doesn't", in a few seconds. On the page this shows as **Mode: Synchronous** and **Provider: prembly**, with the result under **Prembly match**.
2. **The people check (you, the staff).** The document comes to a queue on the Verification page, and a staff member looks at it and clicks **Approve** or **Reject**. On the page this shows as **Mode: Asynchronous** and **Provider: manual**.

### Who goes to the robot, and who comes to us

| Who sends it | Document | Checked by |
|---|---|---|
| Individual host | their own NIN, BVN or driver's licence (number) | Robot (Prembly) |
| Fleet partner | CAC certificate with an RC or BN number | Robot (Prembly) |
| Fleet partner | a director's NIN, BVN or driver's licence | **People** |
| Anyone | passport, tax ID, or any uploaded picture | **People** |
| Vendors | car documents and driver licences | **People** |

The robot only checks an individual host's own ID and a fleet partner's business number. Everything else comes to us.

### "Pending" with "No file" and "No match data"

Sometimes you open a fleet partner's director ID and see **Pending**, **Provider: manual**, **No file** and **No match data**. Here's why:

- The vendor typed an ID **number**. They didn't upload a picture, so there is **no file**.
- A director ID goes to people, not the robot, so the robot never looked at it. That's why there is **no match data**.
- We are not allowed to keep ID numbers (NDPR), so we can't show you the number either.

So the item has nothing to look at, and it **stays Pending forever until someone clicks Approve or Reject**. Nothing is broken, and nothing will move it on its own.

What to do:

- **Approve** only if you are sure who the person is (for example, you spoke to the vendor and checked), and type their legal name exactly.
- Otherwise **Reject** with a clear reason, and ask the vendor to verify with their **CAC number** (the robot checks that in seconds, and it sets the business name payouts must match) or to **upload a picture** of the ID.

The review panel shows a yellow note explaining this whenever you open one of these.

## Trips, explained simply

### Handing over the car

When the vendor hands over the car, the user taps **I've received the car** in the app. That tells us the trip really started, and it releases the vendor's share that was waiting. If the user forgets, it confirms itself **12 hours** after pickup.

If the user has the car but forgot to tap, and it can't wait for the 12 hours, open the booking and click **Confirm receipt for user** (needs the `bookings.confirm_pickup` permission; Operations and Support have it). Type a reason; it goes to the audit log. The **Handover** section on the booking shows when the car was received and who confirmed it: the user, automatically, or AutoVogue staff.

### Finishing the trip

A vendor can only mark a trip complete when both are true:

1. Receipt is confirmed (the user tapped, it auto-confirmed after 12 hours, or staff used the button), and
2. The user tapped **I've returned the car**, or the trip's end time has passed.

The Handover section shows **User reported the car returned** with the time, if they did.

### When the caution fee comes back

- If the user reported the return and the vendor completes the trip with no dispute, the caution fee goes back to the user's wallet **straight away**.
- Otherwise it goes back **24 hours** after the trip is completed, unless a dispute is opened.

## Support tickets, explained simply

### What a ticket is

A ticket is a question a user (on the app) or a vendor (on the dashboard) sends to us. Think of it as a letter in a mailbox. Each letter has a short name like **#7GQ2KD** so everyone can talk about the same one. You find them all under **Support** in the menu. The number on the menu is how many letters nobody has picked up yet.

### What the statuses mean

| Status | What it means |
|---|---|
| **Open** | A new letter. Nobody has started on it. It is our turn. |
| **In progress** | Someone on the team has picked it up and is working on it. Still our turn. |
| **Awaiting reply** | We answered, and now we are waiting for the user or vendor to write back. Their turn. |
| **Closed** | Finished. Nobody can write on it any more. |

When the user or vendor writes back, the ticket goes back to being our turn.

### Users and vendors only ever see "Autovogue Support"

When you reply, the user or vendor does not see your name. They only see **Autovogue Support**, like a shop with one big sign on the door. Inside the admin you still see who really wrote each message, so the team knows who said what.

### Taking over and assigning

- **Take over** puts the ticket on your desk: "I'll handle this one."
- **Assign to...** puts it on someone else's desk (you need the assign permission for this).
- If you reply to a ticket nobody has picked up, it lands on your desk by itself.

The **Assigned to me** tab shows everything on your desk. The **Unassigned** tab shows letters nobody has picked up.

### Internal notes

Switch the reply box to **Internal note** to leave a sticky note for the team, like "I called them, waiting for the bank". Notes are **yellow** and only staff can see them. The user or vendor never sees them, gets no notification, and the status does not change.

### Closing is final

**Close ticket** is like sealing the envelope for good. It can't be opened again, and nobody can reply on it. The user or vendor is told it was closed. If they still need help, they open a new ticket.

### Tickets close on their own

If we are waiting on the user or vendor (**Awaiting reply**) and they don't write back for **7 days**, the ticket closes by itself. They are told, just like when a person closes it.

## Rules for contributors

- **The API decides.** `useCan()` only hides buttons; every request is checked server-side.
- **Every write** goes through `send()` / `useAdminMutation()`, which adds a fresh `Idempotency-Key` per user action (money POSTs require it) and shows "Sent for approval" when the API answers 202.
- **Reasons**: destructive or sensitive actions use `ReasonDialog` (5 to 500 characters); the reason lands in the audit log.
- **Private files** open only through `FileViewerButton`: it asks for a reason, fetches a 5-minute signed link, never caches it and offers no download.
- **No identity data** in the client: no ID numbers, dates of birth or full account numbers in state, logs or toasts. Account numbers are masked unless a Finance user reveals them (logged).
- **Money** is integer kobo end to end; format only in the view with `naira()` from `src/lib/format.ts`. Times show in WAT.
- **Query keys** live in `QUERY_KEYS`; API errors are toasted by the axios interceptor, so don't add `onError` toasts.
- Writing style in UI copy and docs: plain words, no em-dashes.

## Keyboard

- `/` or `Cmd/Ctrl+K` search bookings, people, plates and pages
- Verification review: `A` approve, `R` reject, `J` / `K` next / previous

## Tests

```bash
pnpm test        # Vitest: money/time formatting, API client (Idempotency-Key, CSRF, step-up retry, session expiry)
pnpm typecheck
pnpm test:e2e    # Playwright against the local API and a production-style build on :3301
pnpm test:e2e:dev  # same tests against `pnpm dev` on :3300
```

End-to-end setup (once):

1. Run the API locally on :4000 with `http://localhost:3301` in `CORS_ALLOWED_ORIGINS`.
2. Create a local staff account (`make platform-staff/create` in the API repo), sign in once and set up 2FA. Keep the base32 secret shown under "Can't scan?".
3. Load the local test data in the API repo: `make seed/testdata/areas && make seed/admin-fixtures` (detail-page tests open real paid, disputed, refunded and failed-payout bookings).
4. `cp e2e/.env.example e2e/.env` and fill it in (gitignored). Add `PW_CHANNEL=chrome` to use your installed Chrome instead of downloading Playwright's Chromium.

The suite opens every screen and the first records behind every list, including the dispute workspace (fails on script errors, the error screen or CSP violations), checks the CSP and headers, the signed-out redirect, the command palette, reason rules, a kill switch round trip with step-up (and that `GET /status` follows), reports and CSV export, and, with `E2E_SUPPORT_*` set, that Support gets 403 on settings. Codes are single use, so the suite waits for a fresh 30-second step when it needs a second one.

CI (`.github/workflows/ci.yml`) runs typecheck, Vitest and both builds. E2E stays local because it needs the API and a 2FA account.

## Known follow-ups

- Badges refresh every 10 seconds by polling; a staff realtime channel would make them instant.
- Error reporting (Sentry or similar) is not wired in yet.
