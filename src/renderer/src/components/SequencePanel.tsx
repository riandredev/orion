import { useEffect, useState, type DragEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { AdwAlertDialog } from './AdwAlertDialog'
import {
  sequenceItemKindLabel,
  sequenceItemSubtitle,
  sequenceItemTitle,
  type SequenceCursor,
  type ServiceSequenceItem
} from '../../../shared/service-sequence'
import { readSequenceDrag, writeSequenceDrag, type SequenceDropBody } from '../lib/sequence-drag'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { SlideThumb } from './SlideThumb'
import type { AppIconName } from './icons'

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

const kindIcon: Record<ServiceSequenceItem['kind'], AppIconName> = {
  'order-image': 'images',
  hymn: 'music',
  bible: 'book',
  presentation: 'presentation',
  dictionary: 'passageRef',
  media: 'video',
  web: 'globe'
}

type SequencePanelProps = {
  open: boolean
  onToggle: () => void
  items: ServiceSequenceItem[]
  cursor: SequenceCursor
  follow: boolean
  onToggleFollow: () => void
  onImport: () => void
  onExport: () => void
  onSelect: (index: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onDrop: (body: SequenceDropBody, index: number) => void
}

function Chevron({ direction }: { direction: 'left' | 'right' }): ReactElement {
  return <AppIcon name={direction === 'left' ? 'caretLeft' : 'caretRight'} />
}

function previewLines(item: ServiceSequenceItem, stepIndex: number): string[] {
  if (item.kind === 'bible') return [item.reference, item.text]
  if (item.kind === 'dictionary') {
    const lines = [item.lemma || item.strongs]
    if (item.gloss) lines.push(item.gloss)
    if (item.definition) lines.push(item.definition)
    return lines
  }
  if (item.kind === 'web') return [item.title || item.url, item.url]
  if (item.kind === 'media') return [item.name, item.folder]
  if (item.kind === 'presentation') return [item.title, `Slide ${stepIndex + 1} of ${item.slideCount}`]
  if (item.kind === 'order-image') return [item.name, item.folder]
  return []
}

function SequenceHoverPreview({
  item,
  stepIndex,
  rect,
  imageUrl,
  slideDeck
}: {
  item: ServiceSequenceItem
  stepIndex: number
  rect: DOMRect
  imageUrl: string | null
  slideDeck: { deckId: string; ext: string } | null
}): ReactElement {
  const width = 248
  let left = rect.right + 8
  let top = Math.max(8, rect.top)
  if (left + width > window.innerWidth - 8) left = Math.max(8, rect.left - width - 8)
  const lines = previewLines(item, stepIndex)
  const video = item.kind === 'media' && item.mediaKind === 'video'
  const hasPicture = Boolean(imageUrl || video || slideDeck)
  const estimated = hasPicture ? 210 : 120
  if (top + estimated > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - estimated)

  return createPortal(
    <div className="sequence-hover-preview" style={{ left, top, width }} role="tooltip">
      {imageUrl ? <img src={imageUrl} alt="" /> : null}
      {slideDeck ? (
        <SlideThumb deckId={slideDeck.deckId} ext={slideDeck.ext} slideIndex={stepIndex} />
      ) : null}
      {video ? (
        <video
          src={`${filePathToUrl(item.path)}#t=0.1`}
          muted
          playsInline
          preload="auto"
          onLoadedData={(event) => {
            const el = event.currentTarget
            if (el.currentTime < 0.05) el.currentTime = 0.1
          }}
        />
      ) : null}
      {!hasPicture ? (
        <div className="sequence-hover-preview__text">
          {lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      ) : (
        <p className="sequence-hover-preview__caption">{lines[0]}</p>
      )}
    </div>,
    document.body
  )
}

export function SequencePanel({
  open,
  onToggle,
  items,
  cursor,
  follow,
  onToggleFollow,
  onImport,
  onExport,
  onSelect,
  onRemove,
  onClear,
  onDrop
}: SequencePanelProps): ReactElement {
  const [dropOver, setDropOver] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [deckMeta, setDeckMeta] = useState<Record<string, { sourceExt: string; coverPath?: string }>>({})
  const [slidePaths, setSlidePaths] = useState<Record<string, string[]>>({})
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, true>>({})
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null)

  const presentationKey = items
    .filter((item) => item.kind === 'presentation')
    .map((item) => item.deckId)
    .join('\0')

  useEffect(() => {
    if (!presentationKey) return
    let cancelled = false
    void window.orion.listPresentationDecks().then((rows) => {
      if (cancelled) return
      const next: Record<string, { sourceExt: string; coverPath?: string }> = {}
      for (const row of rows) {
        next[row.id] = { sourceExt: row.sourceExt, ...(row.coverPath ? { coverPath: row.coverPath } : {}) }
      }
      setDeckMeta(next)
    })
    return () => {
      cancelled = true
    }
  }, [presentationKey])

  useEffect(() => {
    if (!hover) return
    const item = items.find((entry) => entry.id === hover.id)
    if (!item || item.kind !== 'presentation' || slidePaths[item.deckId]) return
    let cancelled = false
    void window.orion.getPresentationDeck(item.deckId).then((detail) => {
      if (cancelled) return
      setSlidePaths((prev) => ({
        ...prev,
        [item.deckId]: detail ? detail.slides.map((slide) => slide.path) : []
      }))
    })
    return () => {
      cancelled = true
    }
  }, [hover, items, slidePaths])

  function acceptDrop(event: DragEvent<HTMLElement>): void {
    if (!event.dataTransfer.types.includes('application/x-orion-sequence')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
    setDropOver(true)
  }

  function dropAt(event: DragEvent<HTMLElement>, index: number): void {
    const body = readSequenceDrag(event.dataTransfer)
    setDropOver(false)
    if (!body) return
    event.preventDefault()
    onDrop(body, index)
  }

  return (
    <div className={`sequence-shell ${open ? '' : 'sequence-shell--collapsed'}`}>
      <aside
        className={dropOver ? 'sequence-panel sequence-panel--drop' : 'sequence-panel'}
        aria-label="Run sequence"
        aria-hidden={!open}
        onDragOver={acceptDrop}
        onDragLeave={() => setDropOver(false)}
        onDrop={(event) => dropAt(event, items.length)}
      >
        <div className="sequence-panel__header">
          <div className="sequence-panel__heading">
            <span className="sequence-panel__title">Sequence</span>
            <span className="adw-caption">{items.length}</span>
          </div>
          <div className="sequence-panel__tools">
            <AdwTooltip text={follow ? 'Following the sequence' : 'Follow sequence'}>
              <button
                type="button"
                className={
                  follow
                    ? 'adw-button adw-button--flat adw-button--icon-sm sequence-panel__icon sequence-panel__icon--on'
                    : 'adw-button adw-button--flat adw-button--icon-sm sequence-panel__icon'
                }
                aria-pressed={follow}
                aria-label={follow ? 'Stop following sequence' : 'Follow sequence'}
                disabled={items.length === 0}
                onClick={onToggleFollow}
              >
                <AppIcon name={follow ? 'pause' : 'play'} size={14} />
              </button>
            </AdwTooltip>
            <AdwTooltip text="Import sequence">
              <button
                type="button"
                className="adw-button adw-button--flat adw-button--icon-sm sequence-panel__icon"
                aria-label="Import sequence"
                onClick={onImport}
              >
                <AppIcon name="folder" size={14} />
              </button>
            </AdwTooltip>
            <AdwTooltip text="Export sequence">
              <button
                type="button"
                className="adw-button adw-button--flat adw-button--icon-sm sequence-panel__icon"
                aria-label="Export sequence"
                disabled={items.length === 0}
                onClick={onExport}
              >
                <AppIcon name="save" size={14} />
              </button>
            </AdwTooltip>
            <AdwTooltip text="Clear sequence">
              <button
                type="button"
                className="adw-button adw-button--flat adw-button--icon-sm sequence-panel__icon sequence-panel__icon--clear"
                aria-label="Clear sequence"
                disabled={items.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                <AppIcon name="trash" size={14} />
              </button>
            </AdwTooltip>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="sequence-panel__empty">
            <div className="sequence-empty-state">
              <div className="sequence-empty-state__icon" aria-hidden="true">
                <AppIcon name="listPlus" size={22} />
              </div>
              <p className="sequence-empty-state__text">
                Drag order images, hymns, verses, decks, or definitions here
              </p>
            </div>
          </div>
        ) : (
          <ol className="sequence-panel__list" onScroll={() => setHover(null)}>
            {items.map((item, index) => {
              const selected = index === cursor.itemIndex
              const subtitle = sequenceItemSubtitle(item, selected ? cursor.stepIndex : null)
              const title = sequenceItemTitle(item)
              const thumbPath =
                item.kind === 'order-image'
                  ? item.path
                  : item.kind === 'presentation'
                    ? deckMeta[item.deckId]?.coverPath
                    : undefined
              const thumbUrl = thumbPath && !brokenThumbs[thumbPath] ? filePathToUrl(thumbPath) : null
              const liveDeck = item.kind === 'presentation' && !thumbUrl ? deckMeta[item.deckId] : undefined
              return (
                <li
                  key={item.id}
                  className={selected ? 'sequence-row sequence-row--selected' : 'sequence-row'}
                  onDragOver={acceptDrop}
                  onDrop={(event) => {
                    event.stopPropagation()
                    dropAt(event, index)
                  }}
                  onMouseEnter={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    setHover({ id: item.id, rect })
                  }}
                  onMouseLeave={() => setHover((current) => (current?.id === item.id ? null : current))}
                >
                  <button
                    type="button"
                    className={`sequence-row__main sequence-row__main--${item.kind}`}
                    draggable
                    onDragStart={(event) => {
                      setHover(null)
                      writeSequenceDrag(event.dataTransfer, { op: 'move', id: item.id })
                    }}
                    onClick={() => onSelect(index)}
                  >
                    {thumbUrl ? (
                      <img
                        className="sequence-row__thumb"
                        src={thumbUrl}
                        alt=""
                        onError={() => setBrokenThumbs((prev) => ({ ...prev, [thumbPath!]: true }))}
                      />
                    ) : item.kind === 'presentation' && liveDeck ? (
                      <span className="sequence-row__thumb">
                        <SlideThumb deckId={item.deckId} ext={liveDeck.sourceExt} slideIndex={0} />
                      </span>
                    ) : (
                      <span className="sequence-row__icon" aria-hidden="true">
                        <AppIcon name={kindIcon[item.kind]} size={16} />
                      </span>
                    )}
                    <span className="sequence-row__text">
                      <span className="sequence-row__title">{title}</span>
                      <span className="sequence-row__subtitle">
                        {sequenceItemKindLabel(item)}
                        {subtitle ? ` · ${subtitle}` : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="sequence-row__remove adw-button adw-button--flat adw-button--icon-sm"
                    aria-label={`Remove ${title}`}
                    onClick={() => onRemove(item.id)}
                  >
                    <AppIcon name="close" size={12} />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </aside>
      <AdwAlertDialog
        open={confirmClear}
        title="Clear sequence"
        confirmLabel="Clear"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false)
          onClear()
        }}
        body={<p>Remove every item from the sequence.</p>}
      />
      {open && hover
        ? (() => {
            const item = items.find((entry) => entry.id === hover.id)
            if (!item || item.kind === 'hymn') return null
            const stepIndex = cursor.itemIndex < items.length && items[cursor.itemIndex]?.id === item.id ? cursor.stepIndex : 0
            let imageUrl: string | null = null
            let slideDeck: { deckId: string; ext: string } | null = null
            if (item.kind === 'order-image') imageUrl = filePathToUrl(item.path)
            if (item.kind === 'presentation') {
              const path = [slidePaths[item.deckId]?.[stepIndex], slidePaths[item.deckId]?.[0], deckMeta[item.deckId]?.coverPath].find(
                (entry) => entry && !brokenThumbs[entry]
              )
              const ext = deckMeta[item.deckId]?.sourceExt
              if (path) imageUrl = filePathToUrl(path)
              else if (ext) slideDeck = { deckId: item.deckId, ext }
            }
            return (
              <SequenceHoverPreview
                item={item}
                stepIndex={stepIndex}
                rect={hover.rect}
                imageUrl={imageUrl}
                slideDeck={slideDeck}
              />
            )
          })()
        : null}
      <button
        type="button"
        className="sequence-panel__toggle"
        onClick={onToggle}
        aria-label={open ? 'Hide sequence panel' : 'Show sequence panel'}
        aria-expanded={open}
        title={open ? 'Hide sequence' : 'Show sequence'}
      >
        <Chevron direction={open ? 'left' : 'right'} />
      </button>
    </div>
  )
}
