import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('http://localhost:8000'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.js'],
    globals: true,
    coverage: { reporter: ['text', 'lcov'], provider: 'v8' },
    exclude: ['node_modules/**', 'dist/**'],
  },
})
