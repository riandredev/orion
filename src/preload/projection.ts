import { contextBridge, ipcRenderer } from 'electron'
import type { OrionProjectionPayload } from '../shared/projection'
import type { ProjectionContentInsetsByCategory } from '../shared/projection-content-insets'

type WirePayload = Exclude<OrionProjectionPayload, { type: 'clear' } | { type: 'clear-overlay' }> & {
  mediaUrl?: string
}

export type ProjectionStageState = {
  base: WirePayload | null
  overlay: WirePayload | null
}

contextBridge.exposeInMainWorld('orionProjection', {
  pullContentInsets: (): Promise<ProjectionContentInsetsByCategory> =>
    ipcRenderer.invoke('orion:projection-content-insets-pull'),
  pullHymnTypography: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('orion:hymn-typography-pull'),
  onHymnTypography: (handler: (vars: Record<string, string>) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, vars: Record<string, string>): void => {
      handler(vars)
    }
    ipcRenderer.on('orion:hymn-typography', listener)
    return () => {
      ipcRenderer.removeListener('orion:hymn-typography', listener)
    }
  },
  onContentInsets: (handler: (insets: ProjectionContentInsetsByCategory) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      insets: ProjectionContentInsetsByCategory
    ): void => {
      handler(insets)
    }
    ipcRenderer.on('orion:projection-content-insets', listener)
    return () => {
      ipcRenderer.removeListener('orion:projection-content-insets', listener)
    }
  },
  pullContent: (): Promise<ProjectionStageState | null> =>
    ipcRenderer.invoke('orion:projection-pull'),
  notifyRendered: (): void => {
    ipcRenderer.send('orion:projection-rendered')
  },
  notifySettled: (): void => {
    ipcRenderer.send('orion:projection-settled')
  },
  onContent: (handler: (state: ProjectionStageState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ProjectionStageState): void => {
      handler(state)
    }
    ipcRenderer.on('orion:projection-stage', listener)
    return () => {
      ipcRenderer.removeListener('orion:projection-stage', listener)
    }
  }
})
