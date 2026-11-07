// Writes a strict Content-Security-Policy into the built shell as a <meta>
// tag, so it works on any host (Vercel, Netlify, nginx, S3/R2...). Inline
// scripts the router and theme need are allowed by their SHA-256 hash, not
// by 'unsafe-inline'. Run after `vite build`: node scripts/csp.mjs <mode>
//
// frame-ancestors can't be set from a <meta> tag: the host must send
// `X-Frame-Options: DENY` (see README, Hosting).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const mode = process.argv[2] ?? 'production'
const shell = 'dist/client/_shell.html'

function env(key) {
  if (process.env[key]) return process.env[key]
  for (const f of [`.env.${mode}.local`, `.env.${mode}`, '.env.local', '.env']) {
    if (!existsSync(f)) continue
    const m = readFileSync(f, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (m) return m[1].trim()
  }
  return ''
}

let html = readFileSync(shell, 'utf8')
const hashes = new Set()
for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  if (m[1].trim()) hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
}
const api = env('VITE_API_BASE_URL') || 'http://localhost:4000/api/v1'
const apiOrigin = new URL(api).origin
// Sentry ingest host, only when error reporting is switched on.
const dsn = env('VITE_SENTRY_DSN')
const sentryOrigin = dsn ? new URL(dsn).origin : ''
const policy = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://*.autovogue.app https://*.r2.cloudflarestorage.com https://*.r2.dev ${mode === 'production' ? '' : 'http://localhost:*'}`.trim(),
  'frame-src https://*.r2.cloudflarestorage.com',
  `connect-src 'self' ${apiOrigin} ${sentryOrigin}`.trim(),
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`)
writeFileSync(shell, html)
console.log(`[csp] ${hashes.size} inline script hash(es); API ${apiOrigin}`)
