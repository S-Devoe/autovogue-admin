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
