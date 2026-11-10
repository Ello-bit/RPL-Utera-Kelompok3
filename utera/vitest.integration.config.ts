import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'node:path'

// Uji integrasi ke Supabase sungguhan. Memuat .env.local (URL + anon key) dan
// .env.test.local (email/password akun uji, tidak ikut di-commit karena .env* di-.gitignore).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    include: ['tests/integration/**/*.int.ts'],
    env: loadEnv('test', __dirname, ''),
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
