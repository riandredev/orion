import { type DragEvent, type FormEvent, type ReactElement } from 'react'
import { writeSequenceDrag } from '../lib/sequence-drag'
import { webUrlLabel } from '../lib/web-url'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { Kbd, KbdIcon } from './Kbd'
import type { AppIconName } from './icons'

export type WebTabRibbonProps = {
  urlInput: string
  onUrlInputChange: (value: string) => void
  pageUrl: string | null
  pageTitle?: string
  canGoBack: boolean
  canGoForward: boolean
  webLive: boolean
  onLoad: () => void
  onReload: () => void
  onBack: () => void
  onForward: () => void
  onClear: () => void
  onGoLive: () => void
}

function RibbonIconBtn({
  label,
  icon,
  onClick,
  disabled
}: {
  label: string
  icon: AppIconName
  onClick: () => void
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

export function WebTabRibbon({
  urlInput,
  onUrlInputChange,
  pageUrl,
  pageTitle,
  canGoBack,
  canGoForward,
  webLive,
  onLoad,
  onReload,
  onBack,
  onForward,
  onClear,
  onGoLive
}: WebTabRibbonProps): ReactElement {
  const onSubmit = (e: FormEvent): void => {
    e.preventDefault()
    onLoad()
  }

  return (
    <div className="order-ribbon web-ribbon" role="toolbar" aria-label="Web commands">
      <div className="order-ribbon__row">
        <div className="order-ribbon__section web-ribbon__url-section">
          <span className="adw-section-label">Address</span>
          {pageUrl ? (
            <AdwTooltip text="Drag this page into the sequence">
              <button
                type="button"
                className="adw-button adw-button--flat adw-button--icon-sm order-ribbon__icon-btn"
                draggable
                aria-label="Drag this page into the sequence"
                onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                  writeSequenceDrag(event.dataTransfer, {
                    op: 'insert',
                    draft: {
                      kind: 'web',
                      url: pageUrl,
                      title: pageTitle?.trim() || webUrlLabel(pageUrl)
                    }
                  })
                }}
              >
                <AppIcon name="gripVertical" size={16} />
              </button>
            </AdwTooltip>
          ) : null}
          <form className="web-ribbon__url-form" onSubmit={onSubmit}>
            <span className="web-ribbon__url-icon" aria-hidden="true">
              <AppIcon name="globe" size={16} />
            </span>
            <input
              type="text"
              className="web-ribbon__url-input"
              value={urlInput}
              onChange={(e) => onUrlInputChange(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Web address"
            />
            <AdwTooltip text="Go to address">
              <button
                type="submit"
                className="adw-button adw-button--flat adw-button--icon-sm web-ribbon__go-btn"
                aria-label="Go to address"
              >
                <AppIcon name="searchOutline" size={16} />
              </button>
            </AdwTooltip>
          </form>
        </div>
        <div className="web-ribbon__actions">
        <div className="order-ribbon__section order-ribbon__transport">
          <RibbonIconBtn label="Back" icon="caretLeft" onClick={onBack} disabled={!canGoBack} />
          <RibbonIconBtn
            label="Forward"
            icon="caretRight"
            onClick={onForward}
            disabled={!canGoForward}
          />
          <RibbonIconBtn label="Reload" icon="repeat" onClick={onReload} disabled={!pageUrl} />
          <RibbonIconBtn label="Clear page" icon="clear" onClick={onClear} />
        </div>
        <div className="order-ribbon__section order-ribbon__primary">
          <button
            type="button"
            className={
              webLive
                ? 'adw-button order-ribbon__go-live order-ribbon__go-live--stop'
                : 'adw-button adw-button--suggested order-ribbon__go-live'
            }
            onClick={onGoLive}
            disabled={!webLive && !pageUrl}
          >
            <AppIcon name={webLive ? 'square' : 'expand'} size={16} />
            {webLive ? 'Stop projection' : 'Send to outputs'}
          </button>
        </div>
        </div>
      </div>
      <p className="order-ribbon__hints adw-caption">
        <Kbd>Alt</Kbd> <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> back / forward ·{' '}
        <Kbd>F5</Kbd> reload · <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> send to outputs · <Kbd>Esc</Kbd> stop output
      </p>
    </div>
  )
}
