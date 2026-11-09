import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** GTK tooltip timeouts: first hover, then the short delay while browsing. */
const HOVER_TIMEOUT_MS = 500
const BROWSE_TIMEOUT_MS = 60
const BROWSE_DISABLE_MS = 500
const ANCHOR_PAD = 4
const MAX_POINTER_SHIFT = 32

let browseMode = false
let browseOffTimer: number | undefined

function delayForTooltip(): number {
  return browseMode ? BROWSE_TIMEOUT_MS : HOVER_TIMEOUT_MS
}

function armBrowseMode(): void {
  browseMode = true
  window.clearTimeout(browseOffTimer)
  browseOffTimer = undefined
}

function scheduleBrowseOff(): void {
  window.clearTimeout(browseOffTimer)
  browseOffTimer = window.setTimeout(() => {
    browseMode = false
    browseOffTimer = undefined
  }, BROWSE_DISABLE_MS)
}

type AdwTooltipProps = {
  text: string
  children: ReactNode
  /** Use monospace styling (folder paths). */
  mono?: boolean
}

type TooltipCoords = {
  left: number
  top: number
}

function clampTooltipPosition(
  anchor: DOMRect,
  tipWidth: number,
  tipHeight: number,
  pointerX: number | null
): TooltipCoords {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const box = {
    x: anchor.left - ANCHOR_PAD,
    y: anchor.top - ANCHOR_PAD,
    width: anchor.width + ANCHOR_PAD * 2,
    height: anchor.height + ANCHOR_PAD * 2
  }

  let left = box.x + box.width / 2 - tipWidth / 2
  let top = box.y + box.height

  if (pointerX != null) {
    const distance = pointerX - (box.x + box.width / 2)
    if (distance > MAX_POINTER_SHIFT) left += distance - MAX_POINTER_SHIFT
    else if (distance < -MAX_POINTER_SHIFT) left += distance + MAX_POINTER_SHIFT
  }

  if (left + tipWidth > vw - ANCHOR_PAD) left = vw - ANCHOR_PAD - tipWidth
  if (left < ANCHOR_PAD) left = ANCHOR_PAD

  if (top + tipHeight > vh - ANCHOR_PAD) top = box.y - tipHeight
  if (top < ANCHOR_PAD) top = ANCHOR_PAD

  return { left, top }
}

/** Hover tooltip styled like Adwaita/GTK (portaled so width is not clipped by flex columns). */
export function AdwTooltip({ text, children, mono = false }: AdwTooltipProps): ReactElement {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const hoverRef = useRef(false)
  const pointerXRef = useRef<number | null>(null)
  const showTimerRef = useRef<number | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<TooltipCoords>({ left: 0, top: 0 })

  const clearShowTimer = useCallback(() => {
    window.clearTimeout(showTimerRef.current)
  }, [])

  const updatePosition = useCallback(() => {
    const anchorEl = wrapRef.current
    const tipEl = tooltipRef.current
    if (!anchorEl) return
    const anchor = anchorEl.getBoundingClientRect()

    if (!tipEl) {
      setCoords({ left: anchor.left, top: anchor.bottom + ANCHOR_PAD })
      return
    }

    const tipWidth = tipEl.offsetWidth
    const tipHeight = tipEl.offsetHeight
    if (tipWidth <= 0 || tipHeight <= 0) {
      setCoords({ left: anchor.left, top: anchor.bottom + ANCHOR_PAD })
      return
    }

    setCoords(clampTooltipPosition(anchor, tipWidth, tipHeight, pointerXRef.current))
  }, [])

  const show = useCallback((pointerX: number) => {
    pointerXRef.current = pointerX
    hoverRef.current = true
    if (browseMode) armBrowseMode()
    setMounted(true)
    clearShowTimer()
    const delay = delayForTooltip()
    showTimerRef.current = window.setTimeout(() => {
      if (!hoverRef.current) return
      armBrowseMode()
      setVisible(true)
    }, delay)
  }, [clearShowTimer])

  const hide = useCallback(() => {
    const wasShowing = hoverRef.current && visible
    hoverRef.current = false
    clearShowTimer()
    setVisible(false)
    setMounted(false)
    if (wasShowing || browseMode) scheduleBrowseOff()
  }, [clearShowTimer, visible])

  useLayoutEffect(() => {
    if (!mounted) return
    updatePosition()
  }, [mounted, visible, text, mono, updatePosition])

  useEffect(() => {
    if (!mounted || !visible) return
    const onScrollOrResize = (): void => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [mounted, visible, updatePosition])

  useEffect(() => () => clearShowTimer(), [clearShowTimer])

  const tooltipClass = [
    'adw-tooltip',
    'adw-tooltip--fixed',
    visible ? 'adw-tooltip--visible' : '',
    mono ? 'adw-tooltip--mono' : '',
    mounted && !visible ? 'adw-tooltip--measure' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <span
        ref={wrapRef}
        className="adw-tooltip-wrap"
        onMouseEnter={(event) => show(event.clientX)}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {mounted && text
        ? createPortal(
            <span
              ref={tooltipRef}
              className={tooltipClass}
              role="tooltip"
              style={{ left: coords.left, top: coords.top }}
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </>
  )
}

export function orderFolderPath(root: string, folderName: string): string {
  const base = root.replace(/[/\\]+$/, '')
  const sep = base.includes('\\') ? '\\' : '/'
  return `${base}${sep}${folderName}`
}
