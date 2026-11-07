// PRD 7: the first route must load under 400 KB gzipped. Sums the gzipped
// size of every script, module preload and stylesheet the shell loads up
// front, plus the overview route chunk. Run after a build:
//   node scripts/bundle-size.mjs [limitKB]
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = 'dist/client'
const limit = Number(process.argv[2] ?? 400) * 1024
const html = readFileSync(join(root, '_shell.html'), 'utf8')
const urls = new Set()
for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)) urls.add(m[1])
// The overview (index) route chunk is fetched on first load too.
for (const f of readdirSync(join(root, 'assets'))) if (/^index-.*\.js$/.test(f) || /^_app-.*\.js$/.test(f)) urls.add(`/assets/${f}`)

let total = 0
const rows = []
for (const u of urls) {
  const gz = gzipSync(readFileSync(join(root, u))).length
  total += gz
  rows.push([u, gz])
}
rows.sort((a, b) => b[1] - a[1])
for (const [u, gz] of rows.slice(0, 8)) console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${u}`)
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total (limit ${limit / 1024} KB) across ${rows.length} files`)
if (total > limit) {
  console.error('First-route bundle is over the limit.')
  process.exit(1)
}
