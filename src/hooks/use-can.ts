import { useMe } from '@/services/auth/auth.api'

/**
 * Permission checks for hiding UI. The API checks every request itself;
 * this only keeps people from seeing buttons they can't use.
 */
export function useCan() {
  const { data: me } = useMe()
  const set = new Set(me?.permissions ?? [])
  const can = (...keys: string[]) => keys.some((k) => set.has(k))
  return { can, me }
}
