import type { ReactElement } from 'react'
import { useMediaRibbon, type MediaSortKey } from '../lib/media-ribbon-sync'
import { AppIcon } from './AppIcon'
import { AdwSelect } from './AdwSelect'
import { AdwTooltip } from './AdwTooltip'
import type { AppIconName } from './icons'
import type { OrderLibraryView, OrderThumbSize } from './OrderBlockRibbon'

function RibbonIconBtn({
  label,
  icon,
  onClick,
  disabled,
  pressed
}: {
  label: string
  icon: AppIconName
  onClick?: () => void
  disabled?: boolean
  pressed?: boolean
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
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
      >
        <AppIcon name={icon} size={16} />
      </button>
    </AdwTooltip>
  )
}

export function MediaTabRibbon(): ReactElement {
  const media = useMediaRibbon()

  return (
    <div className="order-ribbon" role="toolbar" aria-label="Media commands">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section">
          {media.previewing ? (
            <RibbonIconBtn label="Back to library" icon="caretLeft" onClick={media.back} />
          ) : null}
          <span className="adw-section-label">{media.previewing ? 'Preview' : 'Folder'}</span>
          <span
            className={
              media.canProject || media.folderName
                ? 'order-ribbon__chip adw-caption'
                : 'order-ribbon__chip order-ribbon__chip--muted adw-caption'
            }
          >
            {media.previewing ? media.name : (media.folderName ?? 'Select a folder')}
          </span>
        </div>
        {media.previewing ? (
          <div className="order-ribbon__section order-ribbon__transport">
            <RibbonIconBtn
              label={media.playing ? 'Pause' : 'Play'}
              icon={media.playing ? 'pause' : 'play'}
              onClick={media.togglePlay}
              disabled={!media.canProject}
            />
            <RibbonIconBtn
              label="Remove from library"
              icon="trash"
              onClick={media.removeMedia}
              disabled={!media.canProject}
            />
          </div>
        ) : (
          <>
            <div className="order-ribbon__section order-ribbon__transport">
              <RibbonIconBtn label="New folder" icon="plus" onClick={media.newFolder} />
              <RibbonIconBtn
                label="Add media"
                icon="video"
                onClick={media.importMedia}
                disabled={!media.folderName}
              />
            </div>
            <div className="order-ribbon__section" role="group" aria-label="View">
              {(
                [
                  ['list', 'List', 'viewList'],
                  ['grid', 'Grid', 'viewGrid'],
                  ['columns', 'Columns', 'viewColumns']
                ] as const
              ).map(([id, label, icon]) => (
                <RibbonIconBtn
                  key={id}
                  label={label}
                  icon={icon}
                  pressed={media.view === (id as OrderLibraryView)}
                  onClick={() => media.setView(id)}
                />
              ))}
            </div>
            <div className="order-ribbon__section order-ribbon__field order-ribbon__field--select">
              <span className="adw-section-label">Sort</span>
              <AdwSelect
                aria-label="Sort media"
                value={media.sortKey}
                options={
                  [
                    { value: 'name', label: 'Name' },
                    { value: 'kind', label: 'Kind' },
                    { value: 'duration', label: 'Duration' },
                    { value: 'size', label: 'Size' },
                    { value: 'modified', label: 'Date modified' }
                  ] as const satisfies readonly { value: MediaSortKey; label: string }[]
                }
                onChange={media.setSortKey}
              />
              <RibbonIconBtn
                label={media.sortDir === 'asc' ? 'Ascending' : 'Descending'}
                icon={media.sortDir === 'asc' ? 'caretUp' : 'caretDown'}
                pressed
                onClick={() => media.setSortDir(media.sortDir === 'asc' ? 'desc' : 'asc')}
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
                      media.thumbSize === size
                        ? 'presentation-segmented__btn presentation-segmented__btn--active'
                        : 'presentation-segmented__btn'
                    }
                    aria-pressed={media.thumbSize === (size as OrderThumbSize)}
                    onClick={() => media.setThumbSize(size)}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="order-ribbon__section order-ribbon__primary">
          <button
            type="button"
            className={
              media.live
                ? 'adw-button order-ribbon__go-live order-ribbon__go-live--stop'
                : 'adw-button adw-button--suggested order-ribbon__go-live'
            }
            onClick={media.goLive}
            disabled={!media.live && !media.canProject}
          >
            <AppIcon name={media.live ? 'square' : 'expand'} size={16} />
            {media.live ? 'Stop projection' : 'Send to outputs'}
          </button>
        </div>
      </div>
      <p className="order-ribbon__hints adw-caption">
        {media.previewing
          ? 'One soundtrack, from this PC when the main display is not an output.'
          : 'Click a file to open it. Headings in the list sort the folder.'}
      </p>
    </div>
  )
}
