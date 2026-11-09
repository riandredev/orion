import { useEffect, useState, type ReactElement } from 'react'
import {
  BIBLE_ANCHORS,
  BIBLE_BLOCK_MARGIN_MAX,
  BLOCK_WIDTH_MAX,
  BLOCK_WIDTH_MIN,
  type BibleBlockMargin
} from '../../../shared/bible-block-layout'
import { FLOW_ANCHOR, type FlowAnchor, type PlacedBlockMap } from '../../../shared/placed-blocks'
import { AdwScale } from './AdwScale'
import { AppIcon } from './AppIcon'

const ANCHOR_LABELS: Record<FlowAnchor, string> = {
  flow: 'In column',
  'top-left': 'Top left',
  top: 'Top',
  'top-right': 'Top right',
  left: 'Left',
  center: 'Center',
  right: 'Right',
  'bottom-left': 'Bottom left',
  bottom: 'Bottom',
  'bottom-right': 'Bottom right'
}

const ANCHORS: { value: FlowAnchor; label: string }[] = [
  { value: FLOW_ANCHOR, label: ANCHOR_LABELS.flow },
  ...BIBLE_ANCHORS.map((value) => ({ value, label: ANCHOR_LABELS[value] }))
]

const SIDES: { key: keyof BibleBlockMargin; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' }
]

function anchorSides(anchor: FlowAnchor): (keyof BibleBlockMargin)[] {
  switch (anchor) {
    case 'flow':
    case 'center':
      return ['top', 'right', 'bottom', 'left']
    case 'top-left':
      return ['top', 'left']
    case 'top':
      return ['top']
    case 'top-right':
      return ['top', 'right']
    case 'left':
      return ['left']
    case 'right':
      return ['right']
    case 'bottom-left':
      return ['bottom', 'left']
    case 'bottom':
      return ['bottom']
    case 'bottom-right':
      return ['bottom', 'right']
  }
}

export function CategoryPlacementCard<T extends string>({
  blocks,
  blockId,
  layout,
  onAnchor,
  onMargin,
  onMarginSides,
  onWidth,
  onReset
}: {
  blocks: { id: T; label: string }[]
  blockId: T
  layout: PlacedBlockMap<T>
  onAnchor: (id: T, anchor: FlowAnchor) => void
  onMargin: (id: T, side: keyof BibleBlockMargin, value: number) => void
  onMarginSides: (id: T, sides: readonly (keyof BibleBlockMargin)[], value: number) => void
  onWidth: (id: T, width: number) => void
  onReset: () => void
}): ReactElement {
  const [sidesOpen, setSidesOpen] = useState(false)
  const block = blocks.find((item) => item.id === blockId) ?? blocks[0]!
  const current = layout[blockId]
  const anchor = current.anchor
  const sides = anchorSides(anchor)
  const inset = Math.max(...sides.map((side) => current.margin[side]))

  useEffect(() => {
    setSidesOpen(false)
  }, [blockId])

  return (
    <div className="settings-type__block">
      <div className="settings-bg__section-head">
        <h3 className="settings-bg__subtitle">Position</h3>
        <p className="adw-caption">Position, margin, and width apply to {block.label.toLowerCase()} only.</p>
      </div>
      <div className="settings-bg__form">
        <div className="settings-bg__field">
          <span className="settings-field__label">{block.label} position</span>
          <div className="bible-anchor-grid" role="group" aria-label={`${block.label} position`}>
            {ANCHORS.map((item) => {
              const active = anchor === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  className={active ? 'bible-anchor-grid__btn bible-anchor-grid__btn--active' : 'bible-anchor-grid__btn'}
                  aria-pressed={active}
                  onClick={() => onAnchor(blockId, item.value)}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="settings-bg__field">
          <div className="settings-bg__field-row">
            <span className="settings-field__label">Margin from corner</span>
            <span className="adw-caption">{inset.toFixed(1)} vmin</span>
          </div>
          <AdwScale
            min={0}
            max={BIBLE_BLOCK_MARGIN_MAX}
            step={0.5}
            value={inset}
            aria-label={`${block.label} margin`}
            onChange={(value) => onMarginSides(blockId, sides, value)}
          />
        </div>
        <div className="settings-bg__field">
          <div className="settings-bg__field-row">
            <span className="settings-field__label">Content width</span>
            <span className="adw-caption">{current.width}%</span>
          </div>
          <AdwScale
            min={BLOCK_WIDTH_MIN}
            max={BLOCK_WIDTH_MAX}
            step={1}
            value={current.width}
            aria-label={`${block.label} content width`}
            onChange={(value) => onWidth(blockId, value)}
          />
        </div>
        <button
          type="button"
          className="adw-action-row bible-block-row"
          aria-expanded={sidesOpen}
          onClick={() => setSidesOpen((open) => !open)}
        >
          <span className="adw-action-row__title">Adjust each side</span>
          <span className={sidesOpen ? 'bible-block-row__chevron bible-block-row__chevron--open' : 'bible-block-row__chevron'}>
            <AppIcon name="caretRight" size={14} />
          </span>
        </button>
        {sidesOpen
          ? SIDES.map((side) => (
              <div key={side.key} className="settings-bg__field">
                <div className="settings-bg__field-row">
                  <span className="adw-caption">{side.label}</span>
                  <span className="adw-caption">{current.margin[side.key].toFixed(1)} vmin</span>
                </div>
                <AdwScale
                  min={0}
                  max={BIBLE_BLOCK_MARGIN_MAX}
                  step={0.5}
                  value={current.margin[side.key]}
                  aria-label={`${block.label} ${side.label} margin`}
                  onChange={(value) => onMargin(blockId, side.key, value)}
                />
              </div>
            ))
          : null}
        <button type="button" className="adw-button adw-button--flat" onClick={onReset}>
          Reset placement
        </button>
      </div>
    </div>
  )
}

export function placedBlockClass(anchor: FlowAnchor): string {
  return anchor === 'flow' ? '' : `proj-block-anchor bible-anchor-${anchor}`
}

export function placedBlockStyle(block: { margin: BibleBlockMargin; width: number }): Record<string, string> {
  return {
    '--block-margin-top': `${block.margin.top}vmin`,
    '--block-margin-right': `${block.margin.right}vmin`,
    '--block-margin-bottom': `${block.margin.bottom}vmin`,
    '--block-margin-left': `${block.margin.left}vmin`,
    ...(block.width < 100 ? { width: `${block.width}%`, maxWidth: `${block.width}%` } : {})
  }
}
