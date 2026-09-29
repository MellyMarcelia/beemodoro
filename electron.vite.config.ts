// Settings for the build tool that turns our code into a working app.
// The app has three parts, each built separately: main (the backstage),
// preload (the go-between) and renderer (the screen).
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // The backstage and the go-between just use the normal settings.
  main: {},
  preload: {},
  // The screen: lets code write '@renderer/...' as a shortcut for
  // 'src/renderer/src/...', and teaches the tool how to read .vue files.
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()]
  }
})
