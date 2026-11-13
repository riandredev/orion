import type { ReactElement } from 'react'
import { useDictionaryActiveEntry } from '../lib/dictionary-ribbon-sync'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { Kbd, KbdIcon } from './Kbd'
import type { AppIconName } from './icons'

export type DictionaryTabRibbonProps = {
  onGoLive?: () => void
  onProjectLive?: () => void
  live?: boolean
  canProject?: boolean
  onAddToSequence?: () => void
  onPrevEntry?: () => void
  onNextEntry?: () => void
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

export function DictionaryTabRibbon({
  onGoLive,
  onProjectLive,
  live = false,
  canProject = false,
  onAddToSequence,
  onPrevEntry,
  onNextEntry
}: DictionaryTabRibbonProps): ReactElement {
  const activeEntry = useDictionaryActiveEntry()
  const hasEntry = activeEntry !== 'Select a lexicon entry'
  const projectEntry = onProjectLive ?? onGoLive

  return (
    <div className="order-ribbon" role="toolbar" aria-label="Dictionary commands">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section">
          <span className="adw-section-label">Active entry</span>
          <span
            className={
              hasEntry
                ? 'order-ribbon__chip adw-caption'
                : 'order-ribbon__chip order-ribbon__chip--muted adw-caption'
            }
          >
            {activeEntry}
          </span>
        </div>
        <div className="order-ribbon__section order-ribbon__transport">
          <RibbonIconBtn label="Previous entry" icon="skipBack" disabled={!hasEntry} onClick={onPrevEntry} />
          <RibbonIconBtn label="Next entry" icon="skipForward" disabled={!hasEntry} onClick={onNextEntry} />
        </div>
        <div className="order-ribbon__section">
          <RibbonIconBtn label="Add to sequence" icon="listPlus" disabled={!hasEntry} onClick={onAddToSequence} />
          <RibbonIconBtn
            label="Project definition"
            icon="play"
            disabled={!hasEntry || !canProject}
            onClick={projectEntry}
          />
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
        <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" /> <KbdIcon name="caretLeft" />{' '}
        <KbdIcon name="caretRight" /> entries · <Kbd>Enter</Kbd> send to outputs · <Kbd>Ctrl</Kbd>{' '}
        <Kbd>Enter</Kbd> send or stop · <Kbd>Esc</Kbd> stop output · Strong&apos;s numbers like H1 or G3056
      </p>
    </div>
  )
}
