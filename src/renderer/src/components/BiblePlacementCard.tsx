import { useEffect, useState, type ReactElement } from 'react'
import {
  BIBLE_ANCHORS,
  BIBLE_BLOCK_MARGIN_MAX,
  BLOCK_WIDTH_MAX,
  BLOCK_WIDTH_MIN,
  type BibleAnchor,
  type BibleBlockId,
  type BibleBlockMargin
} from '../../../shared/bible-block-layout'
import {
  resetBibleBlockLayout,
  updateBibleBlockAnchor,
  updateBibleBlockMargin,
  updateBibleBlockMarginSides,
  updateBibleBlockWidth,
  useBibleBlockLayout
} from '../lib/bible-block-layout-settings'
import { AdwScale } from './AdwScale'
import { AppIcon } from './AppIcon'

const ANCHOR_LABELS: Record<BibleAnchor, string> = {
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

const ANCHORS: { value: BibleAnchor; label: string }[] = BIBLE_ANCHORS.map((value) => ({
  value,
  label: ANCHOR_LABELS[value]
}))

const BLOCKS: { id: BibleBlockId; label: string }[] = [
  { id: 'reference', label: 'Reference' },
  { id: 'translation', label: 'Translation' },
  { id: 'verse', label: 'Verse' }
]

const SIDES: { key: keyof BibleBlockMargin; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' }
]

function anchorSides(anchor: BibleAnchor): (keyof BibleBlockMargin)[] {
  switch (anchor) {
    case 'top-left':
      return ['top', 'left']
    case 'top':
      return ['top']
    case 'top-right':
      return ['top', 'right']
    case 'left':
      return ['left']
    case 'center':
      return ['top', 'right', 'bottom', 'left']
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

export function BiblePlacementCard({ blockId }: { blockId: BibleBlockId }): ReactElement {
  const layout = useBibleBlockLayout()
  const [sidesOpen, setSidesOpen] = useState(false)
  const block = BLOCKS.find((item) => item.id === blockId) ?? BLOCKS[2]!
  const anchor = layout[blockId]
  const margin = layout.margin[blockId]
  const sides = anchorSides(anchor)
  const inset = Math.max(...sides.map((side) => margin[side]))

  useEffect(() => {
    setSidesOpen(false)
  }, [blockId])

  return (
    <div className="settings-type__block">
      <div className="settings-bg__section-head">
        <h3 className="settings-bg__subtitle">Position</h3>
        <p className="adw-caption">Position and margin apply to {block.label.toLowerCase()} only.</p>
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
                  className={
                    active ? 'bible-anchor-grid__btn bible-anchor-grid__btn--active' : 'bible-anchor-grid__btn'
                  }
                  aria-pressed={active}
                  onClick={() => updateBibleBlockAnchor(blockId, item.value)}
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
            onChange={(value) => updateBibleBlockMarginSides(blockId, sides, value)}
          />
        </div>

        <div className="settings-bg__field">
          <div className="settings-bg__field-row">
            <span className="settings-field__label">Content width</span>
            <span className="adw-caption">{layout.width[blockId]}%</span>
          </div>
          <AdwScale
            min={BLOCK_WIDTH_MIN}
            max={BLOCK_WIDTH_MAX}
            step={1}
            value={layout.width[blockId]}
            aria-label={`${block.label} content width`}
            onChange={(value) => updateBibleBlockWidth(blockId, value)}
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
                  <span className="adw-caption">{margin[side.key].toFixed(1)} vmin</span>
                </div>
                <AdwScale
                  min={0}
                  max={BIBLE_BLOCK_MARGIN_MAX}
                  step={0.5}
                  value={margin[side.key]}
                  aria-label={`${block.label} ${side.label} margin`}
                  onChange={(value) => updateBibleBlockMargin(blockId, side.key, value)}
                />
              </div>
            ))
          : null}

        <button type="button" className="adw-button adw-button--flat" onClick={() => resetBibleBlockLayout()}>
          Reset placement
        </button>
      </div>
    </div>
  )
}
