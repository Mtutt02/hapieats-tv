import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // lib/stripe-shapes falls back to a REST call when STRIPE_SECRET_KEY is set: never in tests
    env: { STRIPE_SECRET_KEY: '' },
  },
})
