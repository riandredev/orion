import type { ReactElement } from 'react'
import { usePresentationRibbonState } from '../lib/presentation-ribbon-sync'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { Kbd, KbdIcon } from './Kbd'
import type { AppIconName } from './icons'

export type PresentationTabRibbonProps = {
  onImport: () => void
  importing: boolean
  importEnabled: boolean
  onPrev: () => void
  onNext: () => void
  onProjectSlide: () => void
  onRemoveDeck: () => void
  onOpenPresenterView: () => void
  outputLive: boolean
  onGoLive: () => void
  canProject: boolean
  onAddToSequence?: () => void
}

function RibbonIconBtn({
  label,
  icon,
  onClick,
  disabled
}: {
  label: string
  icon: AppIconName
  onClick?: () => void
  disabled?: boolean
}): ReactElement {
  return (
    <AdwTooltip text={label}>
      <button
        type="button"
        className="adw-button adw-button--flat adw-button--icon-sm order-ribbon__icon-btn"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      >
        <AppIcon name={icon} size={16} />
      </button>
    </AdwTooltip>
  )
}

export function PresentationTabRibbon({
  onImport,
  importing,
  importEnabled,
  onPrev,
  onNext,
  onProjectSlide,
  onRemoveDeck,
  onOpenPresenterView,
  outputLive,
  onGoLive,
  canProject,
  onAddToSequence
}: PresentationTabRibbonProps): ReactElement {
  const { deckTitle, slideIndex, slideTotal } = usePresentationRibbonState()
  const hasDeck = slideTotal > 0
  const position = hasDeck ? slideIndex + 1 : 0
  const disabled = !hasDeck

  return (
    <div className="order-ribbon" role="toolbar" aria-label="Presentation commands">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section">
          <span className="adw-section-label">Active deck</span>
          {hasDeck ? (
            <span className="order-ribbon__chip">
              <AppIcon name="presentation" size={14} />
              {deckTitle}
              <AdwTooltip text="Remove deck">
                <button
                  type="button"
                  className="adw-button adw-button--flat adw-button--icon-sm order-ribbon__chip-clear"
                  onClick={onRemoveDeck}
                  aria-label="Remove deck"
                >
                  <AppIcon name="close" size={12} />
                </button>
              </AdwTooltip>
            </span>
          ) : (
            <span className="order-ribbon__chip order-ribbon__chip--muted adw-caption">
              No deck open
            </span>
          )}
        </div>
        <div className="order-ribbon__section order-ribbon__transport">
          <RibbonIconBtn
            label="Import deck"
            icon="plus"
            onClick={onImport}
            disabled={importing || !importEnabled}
          />
          <RibbonIconBtn
            label="Open presenter view"
            icon="presentation"
            onClick={onOpenPresenterView}
            disabled={disabled}
          />
          <RibbonIconBtn label="Previous slide" icon="caretLeft" onClick={onPrev} disabled={disabled} />
          <span className="order-ribbon__position order-ribbon__position--slide adw-caption" aria-live="polite">
            {position} / {slideTotal || '—'}
          </span>
          <RibbonIconBtn label="Next slide" icon="caretRight" onClick={onNext} disabled={disabled} />
        </div>
        <div className="order-ribbon__section">
          <RibbonIconBtn
            label="Add deck to sequence"
            icon="listPlus"
            onClick={onAddToSequence}
            disabled={disabled}
          />
          <RibbonIconBtn
            label="Project slide"
            icon="play"
            onClick={onProjectSlide}
            disabled={!canProject}
          />
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
            disabled={!outputLive && !canProject}
          >
            <AppIcon name={outputLive ? 'square' : 'expand'} size={16} />
            {outputLive ? 'Stop projection' : 'Send to outputs'}
          </button>
        </div>
      </div>
      <p className="order-ribbon__hints adw-caption">
        <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> slides · <Kbd>Enter</Kbd> project
        slide · <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> send to outputs
      </p>
    </div>
  )
}
