import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: '50%',
        minForks: 1,
        isolate: true,
        singleFork: false,
      },
    },
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    slowTestThreshold: 300,
    fileParallelism: true,
    sequence: {
      seed: 0,
      hooks: 'stack',
    },
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      enabled: false,
      include: ['src/index.ts', 'src/domain/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.config.ts', '**/*.test.ts', '**/*.spec.ts'],
      all: true,
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Org-wide immediate rollout (TEST_STANDARD.md §3): all 16 repositories
      // enable the 4-metric 99% gate on the same day, with no staged ramp-up.
      // A repository under 99% at rollout time goes red in CI; that is the
      // accepted, tracked cost of the decision, not a reason to lower this.
      thresholds: { branches: 99, functions: 99, lines: 99, statements: 99 },
    },
  },
  esbuild: {
    target: 'node24',
    format: 'esm',
    platform: 'node',
  },
})
