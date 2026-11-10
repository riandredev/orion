import type { ReactElement } from 'react'
import { useBibleActivePassage } from '../lib/bible-ribbon-sync'
import { updateBibleMotion, useBibleMotion } from '../lib/bible-motion'
import { lyricAnimationOptions } from '../lib/lyric-motion'
import { AppIcon } from './AppIcon'
import { AdwSelect } from './AdwSelect'
import { withTransitionIcons } from './TransitionIcon'
import { AdwTooltip } from './AdwTooltip'
import { Kbd, KbdIcon } from './Kbd'
import type { AppIconName } from './icons'

export type BibleTabRibbonProps = {
  onGoLive: () => void
  onProjectLive?: () => void
  live: boolean
  canProject: boolean
  onAddToSequence?: () => void
  onPrevVerse?: () => void
  onNextVerse?: () => void
  onPrevBook?: () => void
  onNextBook?: () => void
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

export function BibleTabRibbon({
  onGoLive,
  onProjectLive,
  live,
  canProject,
  onAddToSequence,
  onPrevVerse,
  onNextVerse,
  onPrevBook,
  onNextBook
}: BibleTabRibbonProps): ReactElement {
  const activePassage = useBibleActivePassage()
  const motion = useBibleMotion()
  const hasPassage = activePassage !== 'Select a passage'
  const projectVerse = onProjectLive ?? onGoLive

  return (
    <div className="order-ribbon" role="toolbar" aria-label="Bible commands">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section">
          <span className="adw-section-label">Active passage</span>
          <span
            className={
              hasPassage
                ? 'order-ribbon__chip order-ribbon__chip--stable adw-caption'
                : 'order-ribbon__chip order-ribbon__chip--muted adw-caption'
            }
            title={hasPassage ? activePassage : undefined}
          >
            {activePassage}
          </span>
        </div>
        <div className="order-ribbon__section order-ribbon__transport">
          <RibbonIconBtn label="Previous verse" icon="skipBack" disabled={!hasPassage} onClick={onPrevVerse} />
          <RibbonIconBtn label="Next verse" icon="skipForward" disabled={!hasPassage} onClick={onNextVerse} />
          <RibbonIconBtn label="Previous book" icon="caretUp" disabled={!hasPassage} onClick={onPrevBook} />
          <RibbonIconBtn label="Next book" icon="caretDown" disabled={!hasPassage} onClick={onNextBook} />
        </div>
        <div className="order-ribbon__section">
          <RibbonIconBtn label="Add to sequence" icon="listPlus" onClick={onAddToSequence} />
          <RibbonIconBtn label="Project verse" icon="play" onClick={projectVerse} />
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
              onChange={(e) => updateBibleMotion({ transitionMs: Number(e.target.value) || 0 })}
            />
            <span className="adw-caption">ms</span>
          </label>
          <div className="order-ribbon__field order-ribbon__field--select">
            <span className="adw-section-label">Animation</span>
            <AdwSelect
              value={motion.animation}
              options={withTransitionIcons(lyricAnimationOptions)}
              aria-label="Verse animation"
              onChange={(animation) => updateBibleMotion({ animation })}
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
        <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" /> books ·{' '}
        <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> verses · <Kbd>Enter</Kbd>{' '}
        send to outputs
      </p>
    </div>
  )
}
