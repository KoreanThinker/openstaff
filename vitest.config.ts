import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/renderer/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'src/main/index.ts',
        'src/shared/types/**',
        'src/main/tray/**',
        'src/main/ipc/**',
        'src/main/ngrok/**',
        'src/main/store/config-store.ts',
        'src/main/agent-driver/claude-code-driver.ts',
        'src/main/agent-driver/codex-driver.ts',
        'src/main/agent-driver/gemini-cli-driver.ts',
        'src/main/staff-manager/staff-manager.ts',
        'src/main/api/server.ts'
      ],
      thresholds: {
        lines: 90,
        functions: 95,
        branches: 85,
        statements: 90
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src/renderer/src')
    }
  }
})
