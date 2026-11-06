import { app } from 'electron'

/** Dev vs production — mirrors electron-vite env without extra deps. */
export const is = {
  dev: !app.isPackaged
}

export const electronApp = {
  setAppUserModelId(id: string): void {
    if (process.platform === 'win32') {
      app.setAppUserModelId(id)
    }
  }
}
