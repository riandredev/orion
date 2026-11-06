import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PresentationDeckDetail,
  PresentationDeckSummary,
  PresentationImportProgress
} from '../../../shared/presentation-deck-types'
import type {
  PresentationImportDepsProgress,
  PresentationImportDepsStatus
} from '../../../shared/presentation-import-deps'
import { PresentationImportDepsEmptyState } from './PresentationImportDepsEmptyState'
import { PresentationStage } from './PresentationStage'
import { SlideThumb } from './SlideThumb'
import { AdwAlertDialog } from './AdwAlertDialog'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { writeSequenceDrag } from '../lib/sequence-drag'

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

function importProgressCaption(progress: PresentationImportProgress | null): string | undefined {
  if (!progress) return undefined
  if (progress.phase === 'rendering' && progress.slideIndex != null && progress.slideCount) {
    const pct = progress.percent !== undefined ? ` · ${progress.percent}%` : ''
    return `${progress.message ?? 'Rendering slides…'} (${progress.slideIndex}/${progress.slideCount})${pct}`
  }
  if (progress.message && progress.percent !== undefined) {
    return `${progress.message} · ${progress.percent}%`
  }
  return progress.message
}

function deckTooltip(row: PresentationDeckSummary): string {
  return `${row.title}\n${row.slideCount} slides · ${row.sourceExt.replace('.', '').toUpperCase()}`
}

export type PresentationSlideThumbSize = 's' | 'm' | 'l'

export type PresentationWorkspaceProps = {
  decks: PresentationDeckSummary[]
  deck: PresentationDeckDetail | null
  loadingDeck: boolean
  activeDeckId: string | null
  activeSlideIndex: number
  onSelectDeck: (deckId: string) => void
  onSelectSlide: (index: number) => void
  onRemoveDeck: (deckId: string) => void
  onOpenPresenterView: () => void
  onImportDeck: () => void
  importBusy: boolean
  importProgress: PresentationImportProgress | null
  importError: string | null
  depsStatus: PresentationImportDepsStatus
  depsProgress: PresentationImportDepsProgress | null
  depsDownloading: boolean
  onDownloadDeps: () => void
  onCancelDepsDownload: () => void
  importEnabled: boolean
}

export function PresentationWorkspace({
  decks,
  deck,
  loadingDeck,
  activeDeckId,
  activeSlideIndex,
  onSelectDeck,
  onSelectSlide,
  onRemoveDeck,
  onOpenPresenterView,
  onImportDeck,
  importBusy,
  importProgress,
  importError,
  depsStatus,
  depsProgress,
  depsDownloading,
  onDownloadDeps,
  onCancelDepsDownload,
  importEnabled
}: PresentationWorkspaceProps): ReactElement {
  const [thumbSize, setThumbSize] = useState<PresentationSlideThumbSize>('m')
  const loadDeckSource = useCallback(
    (id: string) => window.orion.readPresentationDeckSource(id),
    []
  )
  const [deckPendingRemove, setDeckPendingRemove] = useState<PresentationDeckSummary | null>(null)
  const selectedThumbRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    selectedThumbRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeSlideIndex, deck?.id])

  const importShowIndeterminate =
    importBusy && (importProgress?.percent === undefined || importProgress.phase === 'converting')
  const importCaption = importProgressCaption(importProgress)

  const requestRemoveDeck = (row: PresentationDeckSummary): void => {
    setDeckPendingRemove(row)
  }

  const confirmRemoveDeck = (): void => {
    if (deckPendingRemove) {
      onRemoveDeck(deckPendingRemove.id)
    }
    setDeckPendingRemove(null)
  }

  const stageToolbar =
    deck && !importBusy && !loadingDeck ? (
      <div className="presentation-stage-toolbar" role="toolbar" aria-label="Slide view options">
        <div className="presentation-stage-toolbar__group">
          <span className="presentation-stage-toolbar__label adw-caption">Thumbnail size</span>
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
                onClick={() => setThumbSize(size)}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="presentation-stage-toolbar__group presentation-stage-toolbar__presenter">
          <AdwTooltip text="Open fullscreen presenter view on this display (like PowerPoint)">
            <button
              type="button"
              className="adw-button adw-button--suggested adw-button--small"
              onClick={onOpenPresenterView}
            >
              <AppIcon name="presentation" size={14} />
              Presenter view…
            </button>
          </AdwTooltip>
        </div>
      </div>
    ) : null

  return (
    <div className="presentation-workspace-shell">
      <div className="presentation-workspace">
        <aside className="presentation-workspace__sidebar adw-card">
          <div className="presentation-workspace__sidebar-head">
            <h2 className="adw-title-4">Decks</h2>
            <AdwTooltip
              text={
                importEnabled
                  ? 'Import PowerPoint or Keynote'
                  : 'Download dependencies in the preview area first'
              }
            >
              <button
                type="button"
                className="adw-button adw-button--suggested adw-button--small"
                onClick={onImportDeck}
                disabled={importBusy || !importEnabled}
              >
                <AppIcon name="plus" size={14} />
                Import…
              </button>
            </AdwTooltip>
          </div>
          {importError ? (
            <p className="presentation-workspace__error adw-caption">{importError}</p>
          ) : null}
          <ul
            className="presentation-workspace__deck-list presentation-deck-list"
            role="listbox"
            aria-label="Imported decks"
          >
            {!importEnabled ? (
              <li className="presentation-workspace__empty adw-caption">
                No decks yet. Download dependencies to import presentations.
              </li>
            ) : decks.length === 0 ? (
              <li className="presentation-workspace__empty adw-caption">
                Import a .pptx, .ppt, or .key file to begin.
              </li>
            ) : (
              decks.map((row) => {
                const selected = row.id === activeDeckId
                return (
                  <li key={row.id} className="presentation-deck-list__row">
                    <AdwTooltip text={deckTooltip(row)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        aria-label={deckTooltip(row).replace('\n', ', ')}
                        className={
                          selected
                            ? 'presentation-deck-list__item presentation-deck-list__item--selected'
                            : 'presentation-deck-list__item'
                        }
                        draggable
                        onDragStart={(event) =>
                          writeSequenceDrag(event.dataTransfer, {
                            op: 'insert',
                            draft: {
                              kind: 'presentation',
                              deckId: row.id,
                              title: row.title,
                              slideCount: row.slideCount
                            }
                          })
                        }
                        onClick={() => onSelectDeck(row.id)}
                      >
                        {row.coverPath ? (
                          <img
                            className="presentation-deck-list__cover"
                            src={filePathToUrl(row.coverPath)}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <SlideThumb
                            className="presentation-deck-list__cover"
                            deckId={row.id}
                            ext={row.sourceExt}
                            slideIndex={0}
                          />
                        )}
                        <span className="presentation-deck-list__meta">
                          <span className="presentation-deck-list__title">{row.title}</span>
                          <span className="presentation-deck-list__subtitle adw-caption">
                            {row.slideCount} slides · {row.sourceExt.replace('.', '').toUpperCase()}
                          </span>
                        </span>
                      </button>
                    </AdwTooltip>
                    <AdwTooltip text="Remove deck">
                      <button
                        type="button"
                        className="presentation-deck-list__remove adw-button adw-button--flat adw-button--icon-sm"
                        aria-label={`Remove ${row.title}`}
                        onClick={() => requestRemoveDeck(row)}
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    </AdwTooltip>
                  </li>
                )
              })
            )}
          </ul>
        </aside>
        <section className="presentation-workspace__stage adw-card">
          {stageToolbar}
          {!importEnabled ? (
            <PresentationImportDepsEmptyState
              status={depsStatus}
              progress={depsProgress}
              downloading={depsDownloading}
              onDownload={onDownloadDeps}
              onCancel={onCancelDepsDownload}
            />
          ) : importBusy && importProgress?.phase === 'waiting' ? (
            <div
              className="presentation-stage-empty"
              role="status"
              aria-live="polite"
              aria-label="Waiting for a presentation file"
            >
              <div className="presentation-stage-empty__inner">
                <h2 className="presentation-stage-empty__title adw-title-2">Choose a file</h2>
                <p className="presentation-stage-empty__desc adw-caption">
                  The file window is open. Pick a PowerPoint or Keynote file, or cancel to come back.
                </p>
              </div>
            </div>
          ) : importBusy ? (
            <div
              className="presentation-stage-empty"
              role="status"
              aria-live="polite"
              aria-label="Importing presentation"
            >
              <div className="presentation-stage-empty__inner">
                <h2 className="presentation-stage-empty__title adw-title-2">Importing deck</h2>
                <p className="presentation-stage-empty__desc adw-caption">
                  Reading the file and preparing the slides.
                </p>
                <div className="presentation-stage-empty__progress">
                  <div className="presentation-stage-empty__progress-meta">
                    {importShowIndeterminate ? (
                      <span className="adw-spinner adw-spinner--sm" aria-hidden />
                    ) : null}
                    <span className="adw-caption">{importCaption ?? 'Starting…'}</span>
                  </div>
                  <div
                    className={
                      importShowIndeterminate
                        ? 'adw-progress-bar adw-progress-bar--presentation adw-progress-bar--indeterminate'
                        : 'adw-progress-bar adw-progress-bar--presentation'
                    }
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={importShowIndeterminate ? undefined : importProgress?.percent}
                  >
                    {!importShowIndeterminate ? (
                      <span
                        className="adw-progress-bar__fill"
                        style={{ width: `${importProgress?.percent ?? 0}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : loadingDeck ? (
            <div className="presentation-stage-empty" role="status">
              <div className="presentation-stage-empty__inner">
                <span className="adw-spinner adw-spinner--sm" aria-hidden />
                <p className="adw-caption">Loading deck…</p>
              </div>
            </div>
          ) : !deck ? (
            <div className="presentation-stage-empty">
              <div className="presentation-stage-empty__inner">
                <p className="adw-caption presentation-workspace__placeholder">
                  Choose a deck or import a presentation to show slides here.
                </p>
              </div>
            </div>
          ) : deck.engine === 'live' && deck.sourcePath ? (
            <div className="presentation-live-layout">
              <PresentationStage
                deckId={deck.id}
                ext={deck.sourceExt}
                cues={deck.cues}
                slideIndex={activeSlideIndex}
                loadSource={loadDeckSource}
                drivePlayback
              />
              <ul
                className="presentation-filmstrip"
                aria-label={`Slides in ${deck.title}`}
              >
                {deck.slides.map((slide) => {
                  const selected = slide.index === activeSlideIndex
                  return (
                    <li key={slide.index}>
                      <button
                        type="button"
                        ref={selected ? selectedThumbRef : undefined}
                        className={
                          selected
                            ? `presentation-filmstrip__item presentation-filmstrip__item--${thumbSize} presentation-filmstrip__item--selected`
                            : `presentation-filmstrip__item presentation-filmstrip__item--${thumbSize}`
                        }
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => onSelectSlide(slide.index)}
                      >
                        <SlideThumb
                          deckId={deck.id}
                          ext={deck.sourceExt}
                          cues={deck.cues}
                          slideIndex={slide.index}
                        />
                        <span className="presentation-filmstrip__num">{slide.index + 1}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <ul
              className={`kanban-column__grid presentation-workspace__slide-grid presentation-workspace__slide-grid--${thumbSize}`}
              aria-label={`Slides in ${deck.title}`}
            >
              {deck.slides.map((slide) => {
                const selected = slide.index === activeSlideIndex
                return (
                  <li key={slide.path}>
                    <button
                      type="button"
                      className={
                        selected ? 'kanban-image kanban-image--selected' : 'kanban-image'
                      }
                      onClick={() => onSelectSlide(slide.index)}
                      title={slide.name}
                    >
                      <img
                        className="kanban-image__img"
                        src={filePathToUrl(slide.path)}
                        alt=""
                        loading="lazy"
                      />
                      <span className="kanban-image__label">{slide.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      <AdwAlertDialog
        open={deckPendingRemove != null}
        title={
          deckPendingRemove
            ? `Remove “${deckPendingRemove.title}” from Orion?`
            : 'Remove deck?'
        }
        body="This deletes the imported presentation from Orion. The original file on your computer is left alone."
        confirmLabel="Remove"
        destructive
        onCancel={() => setDeckPendingRemove(null)}
        onConfirm={confirmRemoveDeck}
      />
    </div>
  )
}
