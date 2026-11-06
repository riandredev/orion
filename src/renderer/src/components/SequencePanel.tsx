import { useState, type DragEvent, type ReactElement } from 'react'
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
import type { AppIconName } from './icons'

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
          <ol className="sequence-panel__list">
            {items.map((item, index) => {
              const selected = index === cursor.itemIndex
              const subtitle = sequenceItemSubtitle(item, selected ? cursor.stepIndex : null)
              const title = sequenceItemTitle(item)
              return (
                <li
                  key={item.id}
                  className={selected ? 'sequence-row sequence-row--selected' : 'sequence-row'}
                  onDragOver={acceptDrop}
                  onDrop={(event) => {
                    event.stopPropagation()
                    dropAt(event, index)
                  }}
                >
                  <button
                    type="button"
                    className={`sequence-row__main sequence-row__main--${item.kind}`}
                    draggable
                    onDragStart={(event) => writeSequenceDrag(event.dataTransfer, { op: 'move', id: item.id })}
                    onClick={() => onSelect(index)}
                  >
                    <span className="sequence-row__icon" aria-hidden="true">
                      <AppIcon name={kindIcon[item.kind]} size={16} />
                    </span>
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
