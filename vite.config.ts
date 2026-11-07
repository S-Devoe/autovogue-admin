import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

// TanStack Start in SPA mode: a static build with no server of our own.
// The browser talks to the Go API directly (cookie session); see README.
export default defineConfig({
  server: { port: 3300 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
    tailwindcss(),
  ],
})
