import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

/** Reads e2e/.env into process.env (values already set win). */
export function loadE2EEnv() {
  const file = new URL('./.env', import.meta.url)
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

export function need(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set. Copy e2e/.env.example to e2e/.env and fill it in.`)
  return v
}

export const API_URL = () => process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1'

function base32(s: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0')
  const out: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(out)
}

/** RFC 6238 code for a step (30 s). */
export function totp(secret: string, step = Math.floor(Date.now() / 30000)) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(step))
  const h = createHmac('sha1', base32(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

// The API accepts each 30-second code once, also across test runs, so the
// last step used is kept on disk (e2e/.auth is gitignored).
const stepFile = new URL('./.auth/last-totp-step', import.meta.url)
const readLast = () => (existsSync(stepFile) ? Number(readFileSync(stepFile, 'utf8')) || 0 : 0)

/** A code the API hasn't seen yet: waits for the next 30-second step if needed. */
export async function freshCode(secret: string) {
  const last = readLast()
  let step = Math.floor(Date.now() / 30000)
  if (step <= last) {
    await new Promise((r) => setTimeout(r, (last + 1) * 30000 - Date.now() + 500))
    step = Math.floor(Date.now() / 30000)
  }
  mkdirSync(new URL('./.auth/', import.meta.url), { recursive: true })
  writeFileSync(stepFile, String(step))
  return totp(secret, step)
}
