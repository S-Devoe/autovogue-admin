/** Build-time settings (see .env.example). The admin holds no secrets. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
export const APP_ENV = ((import.meta.env.VITE_ENV as string | undefined) ?? 'local') as 'local' | 'staging' | 'production'
export const IS_PRODUCTION = APP_ENV === 'production'
