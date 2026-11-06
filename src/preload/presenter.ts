import { contextBridge, ipcRenderer } from 'electron'
import type { PresenterViewState } from '../shared/presenter-view-state'

contextBridge.exposeInMainWorld('orionPresenter', {
  getState: (): Promise<PresenterViewState> => ipcRenderer.invoke('orion:get-presenter-view-state'),
  setSlideIndex: (slideIndex: number): Promise<void> =>
    ipcRenderer.invoke('orion:presenter-set-slide-index', slideIndex),
  setShowAllSlides: (show: boolean): Promise<void> =>
    ipcRenderer.invoke('orion:presenter-set-show-all-slides', show),
  stepSlide: (delta: number): Promise<void> => ipcRenderer.invoke('orion:presenter-step-slide', delta),
  close: (): Promise<void> => ipcRenderer.invoke('orion:close-presenter-view'),
  readDeckSource: (
    deckId: string
  ): Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null> =>
    ipcRenderer.invoke('orion:read-presentation-deck-source', deckId),
  rasterizeMetafiles: (payloads: string[]): Promise<(string | null)[]> =>
    ipcRenderer.invoke('orion:rasterize-metafiles', payloads),
  currentDeckMedia: (): Promise<{
    action: 'play' | 'pause' | 'seek'
    index: number
    time: number
    epoch: number
  } | null> => ipcRenderer.invoke('orion:deck-media-current'),
  syncDeckMedia: (command: {
    action: 'play' | 'pause' | 'seek'
    index: number
    time: number
    epoch: number
  }): void => {
    ipcRenderer.send('orion:deck-media-transport', command)
  },
  onDeckMedia: (
    handler: (command: { action: 'play' | 'pause' | 'seek'; index: number; time: number; epoch: number }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      command: { action: 'play' | 'pause' | 'seek'; index: number; time: number; epoch: number }
    ): void => {
      handler(command)
    }
    ipcRenderer.on('orion:deck-media-sync', listener)
    return () => {
      ipcRenderer.removeListener('orion:deck-media-sync', listener)
    }
  },
  onState: (handler: (state: PresenterViewState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PresenterViewState): void => {
      handler(state)
    }
    ipcRenderer.on('orion:presenter-view-state', listener)
    return () => {
      ipcRenderer.removeListener('orion:presenter-view-state', listener)
    }
  }
})
