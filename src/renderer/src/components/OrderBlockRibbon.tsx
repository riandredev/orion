import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Icon } from '@iconify/react'
import type { OrderFolderImage } from '../env'
import {
  defaultFolderPlayback,
  slideAnimationOptions,
  type FolderPlaybackSettings
} from '../types/image-block'
import { AppIcon } from './AppIcon'
import { AppIcons } from './icons'
import { AdwAlertDialog } from './AdwAlertDialog'
import { AdwSelect } from './AdwSelect'
import { AdwTooltip } from './AdwTooltip'
import { Kbd, KbdIcon } from './Kbd'

export type OrderLibraryView = 'columns' | 'grid' | 'list'
export type OrderThumbSize = 's' | 'm' | 'l'

export type OrderBlockRibbonProps = {
  activeFolderName: string | null
  images: OrderFolderImage[]
  imageIndex: number
  playing: boolean
  settings: FolderPlaybackSettings
  onPrev: () => void
  onNext: () => void
  onTogglePlay: () => void
  onToggleLoop: () => void
  onClearFolder: () => void
  onUpdateSettings: (patch: Partial<FolderPlaybackSettings>) => void
  outputLive: boolean
  onGoLive: () => void
  view: OrderLibraryView
  onViewChange: (view: OrderLibraryView) => void
  thumbSize: OrderThumbSize
  onThumbSizeChange: (size: OrderThumbSize) => void
  onLibraryChanged: (selectFolder?: string) => void
  newFolderSignal: number
}

function IconButton({
  label,
  icon,
  onClick,
  pressed,
  disabled
}: {
  label: string
  icon: keyof typeof AppIcons
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
}): ReactElement {
  return (
    <AdwTooltip text={label}>
      <button
        type="button"
        className={
          pressed
            ? 'adw-button adw-button--flat adw-button--icon-sm order-ribbon__icon-btn order-ribbon__icon-btn--pressed'
            : 'adw-button adw-button--flat adw-button--icon-sm order-ribbon__icon-btn'
        }
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
      >
        <AppIcon name={icon} size={16} />
      </button>
    </AdwTooltip>
  )
}

export function OrderBlockRibbon({
  activeFolderName,
  images,
  imageIndex,
  playing,
  settings,
  onPrev,
  onNext,
  onTogglePlay,
  onToggleLoop,
  onClearFolder,
  onUpdateSettings,
  outputLive,
  onGoLive,
  view,
  onViewChange,
  thumbSize,
  onThumbSizeChange,
  onLibraryChanged,
  newFolderSignal
}: OrderBlockRibbonProps): ReactElement {
  const total = images.length
  const position = total > 0 ? imageIndex + 1 : 0
  const disabled = !activeFolderName || total === 0
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const folderNameRef = useRef<HTMLInputElement>(null)
  const seenFolderSignal = useRef(0)

  useEffect(() => {
    if (newFolderSignal === 0 || newFolderSignal === seenFolderSignal.current) return
    seenFolderSignal.current = newFolderSignal
    setFolderName('')
    setFolderError(null)
    setFolderDialogOpen(true)
  }, [newFolderSignal])

  useEffect(() => {
    if (!folderDialogOpen) return
    const timer = window.setTimeout(() => folderNameRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [folderDialogOpen])

  async function createFolder(): Promise<void> {
    const name = folderName.trim()
    if (!name || folderBusy) {
      setFolderError('Enter a folder name.')
      return
    }
    setFolderBusy(true)
    setFolderError(null)
    try {
      const result = await window.orion.createOrderFolder(name)
      if (!result.ok) {
        setFolderError(result.message)
        return
      }
      setFolderDialogOpen(false)
      onLibraryChanged(result.name)
    } catch {
      setFolderError('Could not create that folder.')
    } finally {
      setFolderBusy(false)
    }
  }

  async function addImages(): Promise<void> {
    if (!activeFolderName || importing) return
    setLibraryError(null)
    setImporting(true)
    try {
      const result = await window.orion.importOrderImages(activeFolderName)
      if (!result.ok) {
        setLibraryError(result.message)
        return
      }
      if (result.added > 0) onLibraryChanged()
    } catch {
      setLibraryError('Could not add those images.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="order-ribbon" role="toolbar" aria-label="Service order">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section">
          <span className="adw-section-label">Active folder</span>
          {activeFolderName ? (
            <span className="order-ribbon__chip">
              <AppIcon name="images" size={14} />
              {activeFolderName}
              <AdwTooltip text="Clear selection">
                <button
                  type="button"
                  className="adw-button adw-button--flat adw-button--icon-sm order-ribbon__chip-clear"
                  onClick={onClearFolder}
                  aria-label="Clear active folder"
                >
                  <AppIcon name="close" size={12} />
                </button>
              </AdwTooltip>
            </span>
          ) : (
            <span className="order-ribbon__chip order-ribbon__chip--muted adw-caption">
              Select a folder
            </span>
          )}
        </div>

        <div className="order-ribbon__section order-ribbon__transport">
          <IconButton
            label="New folder"
            icon="plus"
            onClick={() => {
              setFolderName('')
              setFolderError(null)
              setFolderDialogOpen(true)
            }}
          />
          <IconButton
            label="Add images"
            icon="images"
            disabled={!activeFolderName || importing}
            onClick={() => void addImages()}
          />
        </div>

        <div className="order-ribbon__section" role="group" aria-label="View">
          <IconButton
            label="Columns"
            icon="viewColumns"
            pressed={view === 'columns'}
            onClick={() => onViewChange('columns')}
          />
          <IconButton
            label="Grid"
            icon="viewGrid"
            pressed={view === 'grid'}
            onClick={() => onViewChange('grid')}
          />
          <IconButton
            label="List"
            icon="viewList"
            pressed={view === 'list'}
            onClick={() => onViewChange('list')}
          />
        </div>

        <div className="order-ribbon__section">
          <span className="adw-section-label">Thumbnails</span>
          <div className="presentation-segmented" role="group" aria-label="Thumbnail size">
            {(['s', 'm', 'l'] as const).map((size) => (
              <button
                key={size}
                type="button"
                className={
                  thumbSize === size
                    ? 'presentation-segmented__btn presentation-segmented__btn--active'
                    : 'presentation-segmented__btn'
                }
                aria-pressed={thumbSize === size}
                onClick={() => onThumbSizeChange(size)}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="order-ribbon__section order-ribbon__transport">
          <IconButton label="Previous image" icon="skipBack" onClick={onPrev} />
          <AdwTooltip text={playing ? 'Pause auto-scroll' : 'Start auto-scroll'}>
            <button
              type="button"
              className="adw-button adw-button--flat adw-button--icon-sm order-ribbon__icon-btn"
              onClick={onTogglePlay}
              disabled={disabled || !outputLive}
              aria-label={playing ? 'Pause auto-scroll' : 'Start auto-scroll'}
            >
              <Icon icon={playing ? AppIcons.pause : AppIcons.play} width={17} height={17} />
            </button>
          </AdwTooltip>
          <IconButton label="Next image" icon="skipForward" onClick={onNext} />
          <span className="order-ribbon__position adw-caption">
            Image {position} of {total || '—'}
          </span>
          <IconButton
            label="Loop folder"
            icon="repeat"
            onClick={onToggleLoop}
            pressed={settings.loop}
          />
        </div>

        <div className="order-ribbon__section order-ribbon__settings">
          <label className="order-ribbon__field">
            <span className="adw-section-label">Auto-scroll</span>
            <input
              type="number"
              className="adw-input adw-input--compact adw-input--number"
              min={1}
              max={120}
              value={settings.autoScrollSec}
              disabled={!activeFolderName}
              aria-label="Auto-scroll seconds"
              onChange={(e) =>
                onUpdateSettings({ autoScrollSec: Number(e.target.value) || 1 })
              }
            />
            <span className="adw-caption">s</span>
          </label>
          <label className="order-ribbon__field">
            <span className="adw-section-label">Transition</span>
            <input
              type="number"
              className="adw-input adw-input--compact adw-input--number-wide"
              min={0}
              max={5000}
              step={100}
              value={settings.transitionMs}
              disabled={!activeFolderName}
              aria-label="Transition milliseconds"
              onChange={(e) =>
                onUpdateSettings({ transitionMs: Number(e.target.value) || 0 })
              }
            />
            <span className="adw-caption">ms</span>
          </label>
          <div className="order-ribbon__field order-ribbon__field--select">
            <span className="adw-section-label">Animation</span>
            <AdwSelect
              value={settings.animation}
              options={slideAnimationOptions}
              disabled={!activeFolderName}
              aria-label="Slide animation"
              onChange={(animation) => onUpdateSettings({ animation })}
            />
          </div>
        </div>

        <div className="order-ribbon__section order-ribbon__primary">
          <button
            type="button"
            className={
              outputLive
                ? 'adw-button order-ribbon__go-live order-ribbon__go-live--stop'
                : 'adw-button adw-button--suggested order-ribbon__go-live'
            }
            onClick={onGoLive}
            disabled={!outputLive && disabled}
          >
            <AppIcon name={outputLive ? 'square' : 'expand'} size={16} />
            {outputLive ? 'Stop projection' : 'Send to outputs'}
          </button>
        </div>
      </div>
      {libraryError ? <p className="order-ribbon__hints adw-caption order-new-folder__error">{libraryError}</p> : null}
      <AdwAlertDialog
        open={folderDialogOpen}
        title="New folder"
        confirmLabel="Create"
        busy={folderBusy}
        onCancel={() => {
          if (!folderBusy) setFolderDialogOpen(false)
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
                ref={folderNameRef}
                className="adw-input"
                value={folderName}
                disabled={folderBusy}
                onChange={(event) => {
                  setFolderName(event.target.value)
                  setFolderError(null)
                }}
              />
            </label>
            {folderError ? <p className="order-new-folder__error adw-caption">{folderError}</p> : null}
          </form>
        }
      />
      <p className="order-ribbon__hints adw-caption">
        <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> previous / next image ·{' '}
        <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" /> folders · <Kbd>Space</Kbd> play / pause
      </p>
    </div>
  )
}

export function settingsForFolder(
  map: Record<string, FolderPlaybackSettings>,
  folderName: string | null
): FolderPlaybackSettings {
  if (!folderName) return defaultFolderPlayback()
  return map[folderName] ?? defaultFolderPlayback()
}
