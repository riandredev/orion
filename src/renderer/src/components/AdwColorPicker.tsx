import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from 'react'
import { createPortal } from 'react-dom'
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
  type Hsv
} from '../lib/color-utils'
import { getModalPortalRoot } from '../lib/modal-portal-root'
import { AdwScale } from './AdwScale'

export type AdwColorSwatch = {
  color: string
  label: string
}

type AdwColorPickerProps = {
  value: string
  onChange: (hex: string) => void
  swatches?: readonly AdwColorSwatch[]
  disabled?: boolean
  'aria-label'?: string
}

function hsvFromHex(hex: string): Hsv {
  return hexToHsv(normalizeHex(hex))
}

function SwatchCheck(): ReactElement {
  return (
    <svg className="adw-color-picker__check" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M6.2 11.3 3.4 8.5l1.1-1.1 1.7 1.7 4.4-4.4 1.1 1.1z"
      />
    </svg>
  )
}

const POPOVER_WIDTH = 300
const POPOVER_EST_HEIGHT = 420

function clampPopoverLeft(left: number, portalWidth: number): number {
  const maxLeft = portalWidth - POPOVER_WIDTH - 12
  return Math.min(Math.max(12, left), Math.max(12, maxLeft))
}

export function AdwColorPicker({
  value,
  onChange,
  swatches = [],
  disabled = false,
  'aria-label': ariaLabel = 'Backdrop color'
}: AdwColorPickerProps): ReactElement {
  const customBtnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  const [open, setOpen] = useState(false)
  const [scrimArmed, setScrimArmed] = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const [hsv, setHsv] = useState<Hsv>(() => hsvFromHex(value))
  const [hexDraft, setHexDraft] = useState(normalizeHex(value))

  const normalizedValue = normalizeHex(value)
  const presetMatch = swatches.some(
    (s) => normalizeHex(s.color) === normalizedValue
  )
  const customSelected = !presetMatch

  const reposition = useCallback((): void => {
    const anchor = customBtnRef.current
    const portal = getModalPortalRoot()
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const portalRect = portal.getBoundingClientRect()

    let left = rect.left - portalRect.left
    let top = rect.bottom - portalRect.top + 8
    left = clampPopoverLeft(left, portal.clientWidth)

    if (top + POPOVER_EST_HEIGHT > portal.clientHeight - 12) {
      top = rect.top - portalRect.top - POPOVER_EST_HEIGHT - 8
    }
    top = Math.max(12, top)

    setPopoverPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    reposition()
    const raf = requestAnimationFrame(() => reposition())
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) {
      setScrimArmed(false)
      return
    }
    const id = window.setTimeout(() => setScrimArmed(true), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (open) return
    setHsv(hsvFromHex(normalizedValue))
    setHexDraft(normalizedValue)
  }, [normalizedValue, open])

  useEffect(() => {
    if (!open) return
    const onDocKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onDocKey)
    return () => document.removeEventListener('keydown', onDocKey)
  }, [open])

  const commitHsv = useCallback(
    (next: Hsv) => {
      setHsv(next)
      const hex = hsvToHex(next)
      setHexDraft(hex)
      onChange(hex)
    },
    [onChange]
  )

  function onSvPointer(e: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top))
    const s = (x / rect.width) * 100
    const v = 100 - (y / rect.height) * 100
    commitHsv({ ...hsv, s, v })
  }

  function onSvPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    onSvPointer(e)
  }

  function onSvPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    onSvPointer(e)
  }

  const svX = `${hsv.s}%`
  const svY = `${100 - hsv.v}%`
  const hueCss = `hsl(${hsv.h} 100% 50%)`

  const popover =
    open && !disabled
      ? createPortal(
          <>
            <button
              type="button"
              className={`adw-color-picker__scrim${
                scrimArmed ? '' : ' adw-color-picker__scrim--idle'
              }`.trim()}
              aria-label="Close color picker"
              tabIndex={-1}
              onClick={() => {
                if (scrimArmed) setOpen(false)
              }}
            />
            <div
              id={popoverId}
              ref={popoverRef}
              className="adw-color-picker__popover adw-color-picker__popover--portal"
              role="dialog"
              aria-label="Custom color"
              style={{ top: popoverPos.top, left: popoverPos.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="adw-color-picker__popover-header">
                <span className="adw-color-picker__popover-title">Custom color</span>
              </div>
              <div
                className="adw-color-picker__sv"
                style={{ ['--adw-picker-hue' as string]: `${hsv.h}` }}
                onPointerDown={onSvPointerDown}
                onPointerMove={onSvPointerMove}
              >
                <span
                  className="adw-color-picker__sv-handle"
                  style={{ left: svX, top: svY, backgroundColor: normalizedValue }}
                />
              </div>
              <div className="adw-color-picker__hue-row">
                <span
                  className="adw-color-picker__hue-preview"
                  style={{ backgroundColor: normalizedValue }}
                />
                <AdwScale
                  className="adw-color-picker__hue-scale"
                  min={0}
                  max={360}
                  step={1}
                  value={Math.round(hsv.h)}
                  variant="hue"
                  fillColor={hueCss}
                  aria-label="Hue"
                  onChange={(h) => commitHsv({ ...hsv, h })}
                />
              </div>
              <label className="adw-color-picker__hex-row">
                <span className="adw-section-label">Hex</span>
                <input
                  type="text"
                  className="adw-input adw-input--compact adw-color-picker__hex"
                  value={hexDraft}
                  spellCheck={false}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    setHexDraft(raw.startsWith('#') ? raw : `#${raw}`)
                  }}
                  onBlur={() => {
                    const next = normalizeHex(hexDraft, normalizedValue)
                    setHexDraft(next)
                    commitHsv(hsvFromHex(next))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <div className="adw-color-picker__popover-actions">
                <button
                  type="button"
                  className="adw-button adw-button--flat"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="adw-button adw-button--suggested"
                  onClick={() => setOpen(false)}
                >
                  Select
                </button>
              </div>
            </div>
          </>,
          getModalPortalRoot()
        )
      : null

  return (
    <div className={`adw-color-picker ${open ? 'adw-color-picker--open' : ''}`.trim()}>
      <div className="adw-color-picker__row" role="group" aria-label={ariaLabel}>
        {swatches.map((swatch) => {
          const active = normalizedValue === normalizeHex(swatch.color)
          return (
            <button
              key={swatch.color}
              type="button"
              className={
                active
                  ? 'adw-color-picker__swatch adw-color-picker__swatch--active'
                  : 'adw-color-picker__swatch'
              }
              style={{ backgroundColor: swatch.color }}
              title={swatch.label}
              aria-label={swatch.label}
              disabled={disabled}
              onClick={() => {
                onChange(normalizeHex(swatch.color))
                setOpen(false)
              }}
            >
              {active ? <SwatchCheck /> : null}
            </button>
          )
        })}
        <button
          ref={customBtnRef}
          type="button"
          className={
            customSelected || open
              ? 'adw-color-picker__swatch adw-color-picker__swatch--rainbow adw-color-picker__swatch--active'
              : 'adw-color-picker__swatch adw-color-picker__swatch--rainbow'
          }
          aria-label="Custom color"
          aria-expanded={open}
          aria-controls={popoverId}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((was) => !was)
          }}
        >
          {customSelected && !open ? (
            <span
              className="adw-color-picker__rainbow-dot"
              style={{ backgroundColor: normalizedValue }}
            />
          ) : null}
          {customSelected && !open ? <SwatchCheck /> : null}
        </button>
      </div>
      {popover}
    </div>
  )
}
