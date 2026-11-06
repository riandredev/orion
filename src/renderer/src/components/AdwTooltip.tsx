import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const SHOW_DELAY_MS = 420
const HIDE_MS = 160
const VIEWPORT_PAD = 8
const GAP = 6

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

function clampTooltipPosition(anchor: DOMRect, tipWidth: number, tipHeight: number): TooltipCoords {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = anchor.left
  let top = anchor.bottom + GAP

  if (anchor.right > vw - VIEWPORT_PAD - 24 || left + tipWidth > vw - VIEWPORT_PAD) {
    left = anchor.right - tipWidth
  }

  if (left + tipWidth > vw - VIEWPORT_PAD) {
    left = vw - VIEWPORT_PAD - tipWidth
  }
  if (left < VIEWPORT_PAD) {
    left = VIEWPORT_PAD
  }

  if (top + tipHeight > vh - VIEWPORT_PAD) {
    top = anchor.top - GAP - tipHeight
  }
  if (top < VIEWPORT_PAD) {
    top = VIEWPORT_PAD
  }

  return { left, top }
}

/** Hover tooltip styled like Adwaita/GTK (portaled so width is not clipped by flex columns). */
export function AdwTooltip({ text, children, mono = false }: AdwTooltipProps): ReactElement {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const hoverRef = useRef(false)
  const showTimerRef = useRef<number | undefined>(undefined)
  const hideTimerRef = useRef<number | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<TooltipCoords>({ left: 0, top: 0 })

  const clearTimers = useCallback(() => {
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
  }, [])

  const updatePosition = useCallback(() => {
    const anchorEl = wrapRef.current
    const tipEl = tooltipRef.current
    if (!anchorEl) return
    const anchor = anchorEl.getBoundingClientRect()

    if (!tipEl) {
      setCoords({ left: anchor.left, top: anchor.bottom + GAP })
      return
    }

    const tipWidth = tipEl.offsetWidth
    const tipHeight = tipEl.offsetHeight
    if (tipWidth <= 0 || tipHeight <= 0) {
      setCoords({ left: anchor.left, top: anchor.bottom + GAP })
      return
    }

    setCoords(clampTooltipPosition(anchor, tipWidth, tipHeight))
  }, [])

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current)
    setVisible(false)
    hideTimerRef.current = window.setTimeout(() => {
      if (!hoverRef.current) setMounted(false)
    }, HIDE_MS)
  }, [])

  const show = useCallback(() => {
    hoverRef.current = true
    window.clearTimeout(hideTimerRef.current)
    setMounted(true)
    window.clearTimeout(showTimerRef.current)
    showTimerRef.current = window.setTimeout(() => {
      if (hoverRef.current) {
        setVisible(true)
      }
    }, SHOW_DELAY_MS)
  }, [])

  const hide = useCallback(() => {
    hoverRef.current = false
    window.clearTimeout(showTimerRef.current)
    if (!visible) {
      setMounted(false)
      return
    }
    scheduleHide()
  }, [visible, scheduleHide])

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

  useEffect(() => () => clearTimers(), [clearTimers])

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
        onMouseEnter={show}
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
