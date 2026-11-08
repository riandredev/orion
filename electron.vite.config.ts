import { cpSync, copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

function copyProjectionAssets() {
  return {
    name: 'copy-projection-assets',
    closeBundle() {
      const outDir = resolve('out/main')
      mkdirSync(outDir, { recursive: true })
      copyFileSync(resolve('src/main/projection.html'), resolve(outDir, 'projection.html'))
      copyFileSync(resolve('src/main/projection-client.js'), resolve(outDir, 'projection-client.js'))
      cpSync(resolve('src/main/fonts'), resolve(outDir, 'fonts'), { recursive: true })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyProjectionAssets()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          projection: resolve('src/preload/projection.ts'),
          presenter: resolve('src/preload/presenter.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          presenter: resolve('src/renderer/presenter.html')
        }
      }
    }
  }
})
