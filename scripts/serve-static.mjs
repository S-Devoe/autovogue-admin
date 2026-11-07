// Minimal static host for the built admin (dist/client), for end-to-end tests
// and as a reference for hosting anywhere: every unknown path serves
// _shell.html, assets are cached forever, and the security headers a <meta>
// CSP can't carry are sent here. Usage: node scripts/serve-static.mjs [port]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = join(process.cwd(), 'dist/client')
const port = Number(process.argv[2] ?? 3301)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const security = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Robots-Tag': 'noindex, nofollow',
}

createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, path)
  const isAsset = path.startsWith('/assets/')
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, '_shell.html')
  res.writeHead(200, {
    ...security,
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-store',
  })
  createReadStream(file).pipe(res)
}).listen(port, () => console.log(`admin static on http://localhost:${port}`))
