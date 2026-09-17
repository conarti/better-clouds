import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

const SOURCE_DIRECTORY_PATH = new URL('./src', import.meta.url).pathname
const PROJECT_ROOT_PATH = new URL('.', import.meta.url).pathname

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
          /* Порядок важен: строковый алиас сопоставляется по началу пути, @@ длиннее @ */
          alias: {
            '@@': PROJECT_ROOT_PATH,
            '@': SOURCE_DIRECTORY_PATH,
          },
        },
        /* Без предварительной сборки Vite перезагружает страницу теста на первом импорте */
        optimizeDeps: {
          include: ['postcss'],
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
