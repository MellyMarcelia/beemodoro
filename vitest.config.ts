import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Settings for the automatic tests (run with "npm test"). Uses the same
// '@renderer' shortcut as electron.vite.config.ts so tests can find files the
// same way the app does.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    // Pretend to be a web page, so screen code can be tested without opening a window.
    environment: 'jsdom'
  }
})
