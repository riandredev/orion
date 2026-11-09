import type { ReactElement } from 'react'
import { hymnAnimationOptions, updateHymnMotion, useHymnMotion } from '../lib/hymn-motion'
import { useHymnActiveLabel, useHymnLiveContent } from '../lib/hymns-ribbon-sync'
import { AppIcon } from './AppIcon'
import { AdwSelect } from './AdwSelect'
import { AdwTooltip } from './AdwTooltip'
import { KbdIcon } from './Kbd'
import type { AppIconName } from './icons'

export type HymnsTabRibbonProps = {
  onGoLive?: () => void
  onProjectStanza?: () => void
  onPrevSlide?: () => void
  onNextSlide?: () => void
  onAddToSequence?: () => void
  live?: boolean
  canProject?: boolean
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
        disabled={disabled}
        onClick={onClick}
      >
        <AppIcon name={icon} size={16} />
      </button>
    </AdwTooltip>
  )
}

export function HymnsTabRibbon({
  onGoLive,
  onProjectStanza,
  onPrevSlide,
  onNextSlide,
  onAddToSequence,
  live = false,
  canProject = false
}: HymnsTabRibbonProps): ReactElement {
  const storedLabel = useHymnActiveLabel()
  const hymn = useHymnLiveContent()
  const motion = useHymnMotion()
  const activeHymn = hymn ? `${hymn.number} · ${hymn.title}` : storedLabel
  const hasHymn = activeHymn !== 'Select a hymn'

  return (
    <div className="order-ribbon" role="toolbar" aria-label="Hymn commands">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section">
          <span className="adw-section-label">Active hymn</span>
          <span
            className={
              hasHymn
                ? 'order-ribbon__chip order-ribbon__chip--stable adw-caption'
                : 'order-ribbon__chip order-ribbon__chip--muted adw-caption'
            }
            title={hasHymn ? activeHymn : undefined}
          >
            {activeHymn}
          </span>
        </div>
        <div className="order-ribbon__section order-ribbon__transport">
          <RibbonIconBtn label="Previous slide" icon="skipBack" disabled={!hasHymn} onClick={onPrevSlide} />
          <RibbonIconBtn label="Next slide" icon="skipForward" disabled={!hasHymn} onClick={onNextSlide} />
        </div>
        <div className="order-ribbon__section">
          <RibbonIconBtn label="Add to sequence" icon="listPlus" disabled={!hasHymn} onClick={onAddToSequence} />
          <RibbonIconBtn
            label="Project slide"
            icon="play"
            disabled={!hasHymn || !canProject}
            onClick={onProjectStanza}
          />
        </div>
        <div className="order-ribbon__section order-ribbon__settings">
          <label className="order-ribbon__field">
            <span className="adw-section-label">Transition</span>
            <input
              type="number"
              className="adw-input adw-input--compact adw-input--number-wide"
              min={0}
              max={5000}
              step={100}
              value={motion.transitionMs}
              aria-label="Transition milliseconds"
              onChange={(e) => updateHymnMotion({ transitionMs: Number(e.target.value) || 0 })}
            />
            <span className="adw-caption">ms</span>
          </label>
          <div className="order-ribbon__field order-ribbon__field--select">
            <span className="adw-section-label">Animation</span>
            <AdwSelect
              value={motion.animation}
              options={hymnAnimationOptions}
              aria-label="Slide animation"
              onChange={(animation) => updateHymnMotion({ animation })}
            />
          </div>
        </div>
        <div className="order-ribbon__section order-ribbon__primary">
          <button
            type="button"
            className={
              live
                ? 'adw-button order-ribbon__go-live order-ribbon__go-live--stop'
                : 'adw-button adw-button--suggested order-ribbon__go-live'
            }
            onClick={onGoLive}
            disabled={!live && !canProject}
          >
            <AppIcon name={live ? 'square' : 'expand'} size={16} />
            {live ? 'Stop projection' : 'Send to outputs'}
          </button>
        </div>
      </div>
      <p className="order-ribbon__hints adw-caption">
        Search by number or title · <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" />{' '}
        <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" /> slides · Send to outputs to project
      </p>
    </div>
  )
}
