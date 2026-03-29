import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    exclude: ['e2e/**', 'playwright.config.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/components/**/*.tsx'],
    },
  },
})
