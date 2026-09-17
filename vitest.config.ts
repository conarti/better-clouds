import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

const SOURCE_DIRECTORY_PATH = new URL('./src', import.meta.url).pathname

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue(), WxtVitest()],
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['**/*.browser.test.ts'],
          setupFiles: ['tests/setup/no-network.ts'],
        },
      },
      {
        resolve: {
          alias: {
            '@': SOURCE_DIRECTORY_PATH,
          },
        },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts', 'tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
