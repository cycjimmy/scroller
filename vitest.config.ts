import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['__test__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // `lcov` writes coverage/lcov.info, so the report can be uploaded as a CI
      // artifact without an external coverage service.
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
    },
  },
})
