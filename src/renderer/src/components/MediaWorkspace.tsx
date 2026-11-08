import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react'
import type { OrionDisplayInfo } from '../../../shared/displays'
import type { PresentationUiState } from '../../../shared/presentation-ui-state'
import { projectionDisplayIds } from '../lib/display-projection'
import { publishLibraryMedia } from '../lib/library-media-sync'
import { loadPlaybackSettings } from '../lib/playback-settings'
import { setMediaRibbon, type MediaSortDir, type MediaSortKey } from '../lib/media-ribbon-sync'
import { subscribeMediaSequenceCue } from '../lib/media-sequence-cue'
import { clearPresentationLayer, presentMediaFile } from '../lib/projection'
import { writeSequenceDrag } from '../lib/sequence-drag'
import { AppIcon } from './AppIcon'
import { AdwAlertDialog } from './AdwAlertDialog'
import type { OrderLibraryView, OrderThumbSize } from './OrderBlockRibbon'

type MediaFolder = { name: string; itemCount: number }
type MediaItem = {
  name: string
  path: string
  kind: 'video' | 'audio'
  size: number
  modifiedMs: number
}

const VIEW_KEY = 'orion-media-view-2'
const THUMB_KEY = 'orion-media-thumb-size'
const SORT_KEY = 'orion-media-sort'
const SORT_DIR_KEY = 'orion-media-sort-dir'

const SORT_COLUMNS: { key: MediaSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'kind', label: 'Kind' },
  { key: 'duration', label: 'Duration' },
  { key: 'size', label: 'Size' },
  { key: 'modified', label: 'Modified' }
]

function loadView(): OrderLibraryView {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw === 'columns' || raw === 'grid' || raw === 'list') return raw
  } catch {
    /* ignore */
  }
  return 'list'
}

function loadSortKey(): MediaSortKey {
  try {
    const raw = localStorage.getItem(SORT_KEY)
    if (raw === 'name' || raw === 'kind' || raw === 'duration' || raw === 'size' || raw === 'modified') return raw
  } catch {
    /* ignore */
  }
  return 'name'
}

function loadSortDir(): MediaSortDir {
  try {
    const raw = localStorage.getItem(SORT_DIR_KEY)
    if (raw === 'asc' || raw === 'desc') return raw
  } catch {
    /* ignore */
  }
  return 'asc'
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function formatModified(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function compareMedia(
  a: MediaItem,
  b: MediaItem,
  key: MediaSortKey,
  dir: MediaSortDir,
  durations: Record<string, number>
): number {
  const nameOrder = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  let order = 0
  let flip = true
  if (key === 'name') order = nameOrder
  else if (key === 'kind') order = a.kind.localeCompare(b.kind) || nameOrder
  else if (key === 'size') order = a.size - b.size
  else if (key === 'modified') order = a.modifiedMs - b.modifiedMs
  else {
    const da = durations[a.path]
    const db = durations[b.path]
    const aKnown = da != null && da > 0
    const bKnown = db != null && db > 0
    if (aKnown && bKnown) order = da - db
    else if (aKnown !== bKnown) {
      order = aKnown ? -1 : 1
      flip = false
    }
  }
  if (order === 0) order = nameOrder
  return flip && dir === 'desc' ? -order : order
}

function loadThumb(): OrderThumbSize {
  try {
    const raw = localStorage.getItem(THUMB_KEY)
    if (raw === 's' || raw === 'm' || raw === 'l') return raw
  } catch {
    /* ignore */
  }
  return 'm'
}

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

function MediaTile({
  item,
  onDuration
}: {
  item: MediaItem
  onDuration?: (path: string, seconds: number) => void
}): ReactElement {
  if (item.kind === 'audio') {
    return (
      <span className="kanban-image__img media-tile" aria-hidden="true">
        <AppIcon name="music" size={22} />
      </span>
    )
  }
  return (
    <span className="kanban-image__img media-tile">
      <video
        src={filePathToUrl(item.path)}
        muted
        preload="metadata"
        playsInline
        onLoadedMetadata={(event) => onDuration?.(item.path, event.currentTarget.duration)}
      />
    </span>
  )
}

type MediaWorkspaceProps = {
  displays: OrionDisplayInfo[]
  livePath: string | null
  onProjected: (ui: PresentationUiState) => void
}

export function MediaWorkspace({ displays, livePath, onProjected }: MediaWorkspaceProps): ReactElement {
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [folderName, setFolderName] = useState<string | null>(null)
  const [filesByFolder, setFilesByFolder] = useState<Record<string, MediaItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<MediaItem | null>(null)
  const [playing, setPlaying] = useState(false)
  const [view, setView] = useState<OrderLibraryView>(loadView)
  const [thumbSize, setThumbSize] = useState<OrderThumbSize>(loadThumb)
  const [sortKey, setSortKey] = useState<MediaSortKey>(loadSortKey)
  const [sortDir, setSortDir] = useState<MediaSortDir>(loadSortDir)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const durationsRef = useRef<Record<string, number>>({})
  const [folderDialog, setFolderDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const playerRef = useRef<HTMLMediaElement | null>(null)
  const libraryEpoch = useRef(0)
  const startOnPresent = useRef(false)
  const displaysRef = useRef(displays)
  displaysRef.current = displays
  const nameRef = useRef<HTMLInputElement>(null)

  const refreshFolders = useCallback(async (select?: string) => {
    const list = await window.orion.listMediaFolders()
    setFolders(list)
    setFolderName((current) => {
      if (select && list.some((folder) => folder.name === select)) return select
      if (current && list.some((folder) => folder.name === current)) return current
      return list[0]?.name ?? null
    })
  }, [])

  useEffect(() => {
    void refreshFolders().finally(() => setLoading(false))
  }, [refreshFolders])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows: Record<string, MediaItem[]> = {}
      for (const folder of folders) {
        rows[folder.name] = await window.orion.listMediaFolder(folder.name)
      }
      if (!cancelled) setFilesByFolder(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [folders])

  const items = folderName ? (filesByFolder[folderName] ?? []) : []

  useEffect(() => {
    return subscribeMediaSequenceCue((cue) => {
      setFolderName(cue.folder)
      const found = (filesByFolder[cue.folder] ?? []).find((file) => file.path === cue.path)
      if (found) {
        startOnPresent.current = loadPlaybackSettings().autoplayLibraryMedia
        setPlaying(false)
        setPreview(found)
        if (!startOnPresent.current) playerRef.current?.pause()
      }
    })
  }, [filesByFolder])

  const rememberDuration = useCallback((path: string, seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    if (durationsRef.current[path] === seconds) return
    durationsRef.current[path] = seconds
    setDurations({ ...durationsRef.current })
  }, [])

  const sortedItems = [...items].sort((a, b) => compareMedia(a, b, sortKey, sortDir, durations))

  const sortFiles = useCallback(
    (files: MediaItem[]) => [...files].sort((a, b) => compareMedia(a, b, sortKey, sortDir, durations)),
    [durations, sortDir, sortKey]
  )

  const audioPathsKey = (view === 'columns' ? Object.values(filesByFolder).flat() : items)
    .filter((item) => item.kind === 'audio')
    .map((item) => item.path)
    .join('\n')

  useEffect(() => {
    const pending = audioPathsKey
      .split('\n')
      .filter((path) => path && durationsRef.current[path] == null)
    if (pending.length === 0) return
    let cancelled = false
    let cursor = 0
    const pump = (): void => {
      if (cancelled || cursor >= pending.length) return
      const path = pending[cursor]
      cursor += 1
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      const finish = (seconds: number): void => {
        audio.onloadedmetadata = null
        audio.onerror = null
        audio.removeAttribute('src')
        audio.load()
        if (!cancelled) rememberDuration(path, seconds)
        pump()
      }
      audio.onloadedmetadata = () => finish(audio.duration)
      audio.onerror = () => finish(0)
      audio.src = filePathToUrl(path)
    }
    pump()
    pump()
    return () => {
      cancelled = true
    }
  }, [audioPathsKey, rememberDuration])

  const live = Boolean(preview && livePath && preview.path === livePath)
  const soundOnThisPc =
    !live || !displays.some((display) => display.primary && projectionDisplayIds(displays).includes(display.id))

  const importMedia = useCallback(() => {
    if (!folderName) return
    setError(null)
    void window.orion.importMedia(folderName).then(async (result) => {
      if (!Array.isArray(result)) {
        setError(result.message)
        return
      }
      await refreshFolders(folderName)
    })
  }, [folderName, refreshFolders])

  const createFolder = useCallback(() => {
    setFolderBusy(true)
    void window.orion.createMediaFolder(newName).then(async (result) => {
      setFolderBusy(false)
      if (!result.ok) {
        setFolderError(result.message)
        return
      }
      setFolderDialog(false)
      setNewName('')
      await refreshFolders(result.name)
    })
  }, [newName, refreshFolders])

  const goLive = useCallback(() => {
    if (!preview) return
    if (live) {
      void clearPresentationLayer('presentation').then(onProjected)
      return
    }
    const el = playerRef.current
    const primaryOwnsAudio = displaysRef.current.some(
      (display) => display.primary && projectionDisplayIds(displaysRef.current).includes(display.id)
    )
    if (el && primaryOwnsAudio) {
      el.muted = true
      el.volume = 0
    }
    if (libraryEpoch.current === 0) libraryEpoch.current = 1
    const autoplay = loadPlaybackSettings().autoplayLibraryMedia
    startOnPresent.current = autoplay
    if (el) {
      if (autoplay) void el.play().catch(() => setError('Could not play that file.'))
      else el.pause()
    }
    const send = (): void => {
      publishLibraryMedia(autoplay ? 'play' : 'pause', el?.currentTime || 0, libraryEpoch.current)
    }
    send()
    void presentMediaFile(preview, displaysRef.current, loadPlaybackSettings().autoplayLibraryMedia).then((ui) => {
      send()
      onProjected(ui)
    })
  }, [live, onProjected, preview])

  const togglePlay = useCallback(() => {
    const el = playerRef.current
    if (!el || !soundOnThisPc) return
    if (el.paused) void el.play().catch(() => setError('Could not play that file.'))
    else el.pause()
  }, [soundOnThisPc])

  useEffect(() => {
    setMediaRibbon({
      name: preview?.name ?? 'No media selected',
      folderName,
      previewing: preview != null,
      playing,
      live,
      soundOnThisPc,
      canProject: preview != null,
      view,
      thumbSize,
      sortKey,
      sortDir,
      importMedia,
      removeMedia: () => {
        if (preview) setConfirmRemove(true)
      },
      togglePlay,
      goLive,
      newFolder: () => {
        setNewName('')
        setFolderError(null)
        setFolderDialog(true)
      },
      back: () => {
        playerRef.current?.pause()
        setPreview(null)
        setPlaying(false)
      },
      setView: (next) => {
        setView(next)
        try {
          localStorage.setItem(VIEW_KEY, next)
        } catch {
          /* ignore */
        }
      },
      setThumbSize: (next) => {
        setThumbSize(next)
        try {
          localStorage.setItem(THUMB_KEY, next)
        } catch {
          /* ignore */
        }
      },
      setSortKey: (next) => {
        setSortKey(next)
        try {
          localStorage.setItem(SORT_KEY, next)
        } catch {
          /* ignore */
        }
      },
      setSortDir: (next) => {
        setSortDir(next)
        try {
          localStorage.setItem(SORT_DIR_KEY, next)
        } catch {
          /* ignore */
        }
      }
    })
  }, [folderName, goLive, importMedia, live, playing, preview, soundOnThisPc, sortDir, sortKey, thumbSize, togglePlay, view])

  useEffect(() => {
    const el = playerRef.current
    if (!el) return
    el.muted = !soundOnThisPc
    el.volume = soundOnThisPc ? 1 : 0
  }, [live, preview?.path, soundOnThisPc])

  useEffect(() => {
    const el = playerRef.current
    if (!el || !live) return
    const epoch = ++libraryEpoch.current
    let timer = 0
    const send = (action: 'play' | 'pause' | 'seek'): void => {
      publishLibraryMedia(action, el.currentTime || 0, epoch)
    }
    const start = (): void => {
      window.clearInterval(timer)
      send('play')
      timer = window.setInterval(() => {
        if (!el.paused) send('play')
      }, 160)
    }
    const stop = (): void => {
      window.clearInterval(timer)
      send('pause')
    }
    const onSeeked = (): void => {
      send(el.paused ? 'pause' : 'seek')
    }
    el.addEventListener('playing', start)
    el.addEventListener('pause', stop)
    el.addEventListener('seeked', onSeeked)
    if (el.paused && startOnPresent.current) {
      startOnPresent.current = false
      void el.play().catch(() => setError('Could not play that file.'))
    } else if (el.paused) send('pause')
    else start()
    return () => {
      window.clearInterval(timer)
      el.removeEventListener('playing', start)
      el.removeEventListener('pause', stop)
      el.removeEventListener('seeked', onSeeked)
    }
  }, [live, preview?.path])

  useEffect(() => {
    if (folderDialog) nameRef.current?.focus()
  }, [folderDialog])

  const openFile = (item: MediaItem): void => {
    setError(null)
    setPlaying(false)
    setPreview(item)
  }

  const chooseSort = (key: MediaSortKey): void => {
    if (key === sortKey) {
      const next = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(next)
      try {
        localStorage.setItem(SORT_DIR_KEY, next)
      } catch {
        /* ignore */
      }
      return
    }
    const nextDir: MediaSortDir = key === 'name' || key === 'kind' ? 'asc' : 'desc'
    setSortKey(key)
    setSortDir(nextDir)
    try {
      localStorage.setItem(SORT_KEY, key)
      localStorage.setItem(SORT_DIR_KEY, nextDir)
    } catch {
      /* ignore */
    }
  }

  const dragMedia = (event: DragEvent, item: MediaItem, folder: string): void => {
    writeSequenceDrag(event.dataTransfer, {
      op: 'insert',
      draft: {
        kind: 'media',
        folder,
        path: item.path,
        name: item.name,
        mediaKind: item.kind
      }
    })
  }

  const fileButton = (item: MediaItem, className: string, folder: string): ReactElement => (
    <button
      type="button"
      className={className}
      title={item.name}
      draggable
      onDragStart={(event) => dragMedia(event, item, folder)}
      onClick={() => openFile(item)}
    >
      <MediaTile item={item} onDuration={rememberDuration} />
      <span className="kanban-image__label">{item.name}</span>
    </button>
  )

  return (
    <div className="media-workspace">
      {preview ? (
        <div className="presentation-live-layout media-preview">
          <div className="presentation-live">
            <div className="presentation-live__fit">
              <div className="presentation-live__stage media-preview__stage">
                {preview.kind === 'audio' ? (
                  <div className="media-stage__audio">
                    <AppIcon name="music" size={28} />
                    <p className="media-stage__title">{preview.name}</p>
                    <audio
                      key={preview.path}
                      ref={(node) => {
                        playerRef.current = node
                      }}
                      src={filePathToUrl(preview.path)}
                      controls
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onVolumeChange={(event) => {
                        if (!soundOnThisPc && !event.currentTarget.muted) event.currentTarget.muted = true
                      }}
                    />
                  </div>
                ) : (
                  <video
                    key={preview.path}
                    ref={(node) => {
                      playerRef.current = node
                    }}
                    className="media-preview__video"
                    src={filePathToUrl(preview.path)}
                    controls
                    playsInline
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onVolumeChange={(event) => {
                      if (!soundOnThisPc && !event.currentTarget.muted) event.currentTarget.muted = true
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : view === 'columns' ? (
        <div className={`kanban-board kanban-board--${thumbSize}`}>
          {loading && folders.length > 0 ? <p className="kanban-board__status adw-caption">Loading media…</p> : null}
          {folders.map((folder) => {
            const files = sortFiles(filesByFolder[folder.name] ?? [])
            return (
              <section
                key={folder.name}
                className={folder.name === folderName ? 'kanban-column kanban-column--active' : 'kanban-column'}
              >
                <div className="kanban-column__header">
                  <button
                    type="button"
                    className="kanban-column__header-main"
                    onClick={() => setFolderName(folder.name)}
                  >
                    <span className="kanban-column__title">{folder.name}</span>
                    <span className="kanban-column__count adw-caption">{files.length}</span>
                  </button>
                </div>
                {files.length === 0 ? (
                  <p className="kanban-column__empty adw-caption">No media in this folder</p>
                ) : (
                  <ul className={`kanban-column__grid kanban-column__grid--${thumbSize}`}>
                    {files.map((item) => (
                      <li key={item.path}>{fileButton(item, 'kanban-image', folder.name)}</li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
          {!loading && folders.length === 0 ? (
            <div className="kanban-empty adw-card">
              <p className="adw-title-2">No folders</p>
              <p className="adw-caption">Create a folder, then add video or audio.</p>
              <button type="button" className="adw-button adw-button--suggested" onClick={() => setFolderDialog(true)}>
                New folder
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="order-browser">
          <div className="order-browser__folders" role="navigation" aria-label="Folders">
            {folders.length === 0 && !loading ? (
              <div className="order-browser__empty">
                <p className="adw-caption">No folders</p>
                <button type="button" className="adw-button adw-button--suggested" onClick={() => setFolderDialog(true)}>
                  New folder
                </button>
              </div>
            ) : (
              <ul className="order-folder-list">
                {folders.map((folder) => (
                  <li key={folder.name}>
                    <button
                      type="button"
                      className={
                        folder.name === folderName
                          ? 'order-folder-list__item order-folder-list__item--selected'
                          : 'order-folder-list__item'
                      }
                      onClick={() => setFolderName(folder.name)}
                    >
                      <span className="order-folder-list__name">{folder.name}</span>
                      <span className="order-folder-list__count adw-caption">{folder.itemCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="order-browser__images">
            {!folderName ? (
              <p className="adw-caption order-browser__status">Select a folder</p>
            ) : items.length === 0 ? (
              <p className="adw-caption order-browser__status">No media in this folder</p>
            ) : view === 'grid' ? (
              <ul className={`order-image-grid order-image-grid--${thumbSize}`}>
                {sortedItems.map((item) => (
                  <li key={item.path}>{fileButton(item, 'order-image-grid__item', folderName ?? '')}</li>
                ))}
              </ul>
            ) : (
              <div className={`media-list media-list--${thumbSize}`}>
                <div className="media-list__head" role="row">
                  <span className="media-list__thumb" aria-hidden="true" />
                  {SORT_COLUMNS.map((column) => (
                    <button
                      key={column.key}
                      type="button"
                      className={
                        sortKey === column.key ? 'media-list__sort media-list__sort--active' : 'media-list__sort'
                      }
                      aria-sort={
                        sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      onClick={() => chooseSort(column.key)}
                    >
                      <span>{column.label}</span>
                      {sortKey === column.key ? (
                        <AppIcon name={sortDir === 'asc' ? 'caretUp' : 'caretDown'} size={12} />
                      ) : null}
                    </button>
                  ))}
                </div>
                <ul className="media-list__rows">
                  {sortedItems.map((item) => (
                    <li key={item.path}>
                      <button
                        type="button"
                        className="media-list__row"
                        title={item.name}
                        draggable={Boolean(folderName)}
                        onDragStart={(event) => {
                          if (folderName) dragMedia(event, item, folderName)
                        }}
                        onClick={() => openFile(item)}
                      >
                        <MediaTile item={item} onDuration={rememberDuration} />
                        <span className="media-list__name">{item.name}</span>
                        <span className="media-list__meta">{item.kind === 'video' ? 'Video' : 'Audio'}</span>
                        <span className="media-list__meta">{formatDuration(durations[item.path])}</span>
                        <span className="media-list__meta">{formatBytes(item.size)}</span>
                        <span className="media-list__meta">{formatModified(item.modifiedMs)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {error ? <p className="order-ribbon__hints adw-caption order-new-folder__error">{error}</p> : null}
      <AdwAlertDialog
        open={folderDialog}
        title="New folder"
        confirmLabel="Create"
        busy={folderBusy}
        onCancel={() => {
          if (!folderBusy) setFolderDialog(false)
        }}
        onConfirm={() => void createFolder()}
        body={
          <form
            className="order-new-folder"
            onSubmit={(event) => {
              event.preventDefault()
              void createFolder()
            }}
          >
            <label className="order-new-folder__field">
              <span className="adw-caption">Name</span>
              <input
                ref={nameRef}
                className="adw-input"
                value={newName}
                disabled={folderBusy}
                onChange={(event) => {
                  setNewName(event.target.value)
                  setFolderError(null)
                }}
              />
            </label>
            {folderError ? <p className="order-new-folder__error adw-caption">{folderError}</p> : null}
          </form>
        }
      />
      <AdwAlertDialog
        open={confirmRemove}
        title="Remove media"
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          if (!preview) return
          const path = preview.path
          setConfirmRemove(false)
          void window.orion.removeMedia(path).then((ok) => {
            if (!ok) {
              setError('Could not remove that file.')
              return
            }
            if (livePath === path) void clearPresentationLayer('presentation').then(onProjected)
            setPreview(null)
            return refreshFolders(folderName ?? undefined)
          })
        }}
        body={<p>Remove “{preview?.name}” from this folder.</p>}
      />
    </div>
  )
}
