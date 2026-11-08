import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from 'react'
import type { OrionDisplayInfo } from '../../../shared/displays'
import { snapArrangementPosition } from '../../../shared/display-arrangement'
import {
  buildLayoutMonitors,
  clearSavedLayoutPositions,
  DISPLAY_LAYOUT_CANVAS,
  layoutToSavedPositions,
  loadSavedLayoutPositions,
  reorderLayoutMonitors,
  saveLayoutPositions,
  type LayoutMonitor
} from '../lib/display-layout'

type DisplayArrangementCanvasProps = {
  displays: OrionDisplayInfo[]
  onLayoutChange?: () => void
}

function formatResolution(display: OrionDisplayInfo): string {
  return `${display.bounds.width} × ${display.bounds.height}`
}

function canvasScaleFromRect(rect: DOMRect): { scaleX: number; scaleY: number } {
  return {
    scaleX: DISPLAY_LAYOUT_CANVAS.width / rect.width,
    scaleY: DISPLAY_LAYOUT_CANVAS.height / rect.height
  }
}

const CANVAS_BOUNDS = {
  x: 0,
  y: 0,
  width: DISPLAY_LAYOUT_CANVAS.width,
  height: DISPLAY_LAYOUT_CANVAS.height
}

export function DisplayArrangementCanvas({
  displays,
  onLayoutChange
}: DisplayArrangementCanvasProps): ReactElement {
  const [monitors, setMonitors] = useState<LayoutMonitor[]>([])
  const [drag, setDrag] = useState<{
    id: number
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (displays.length <= 1 && Object.keys(loadSavedLayoutPositions()).length > 0) {
      clearSavedLayoutPositions()
    }
    setMonitors(buildLayoutMonitors(displays, loadSavedLayoutPositions()))
  }, [displays])

  const resetToSystem = useCallback(() => {
    clearSavedLayoutPositions()
    setMonitors(buildLayoutMonitors(displays, {}))
    onLayoutChange?.()
  }, [displays, onLayoutChange])

  const onMonitorPointerDown = (monitor: LayoutMonitor, e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || displays.length < 2) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    const { scaleX, scaleY } = canvasScaleFromRect(rect)
    const pointerX = (e.clientX - rect.left) * scaleX
    const pointerY = (e.clientY - rect.top) * scaleY
    setDrag({
      id: monitor.display.id,
      pointerId: e.pointerId,
      offsetX: pointerX - monitor.x,
      offsetY: pointerY - monitor.y
    })
  }

  useEffect(() => {
    if (!drag) return

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== drag.pointerId) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { scaleX, scaleY } = canvasScaleFromRect(rect)
      const pointerX = (e.clientX - rect.left) * scaleX
      const pointerY = (e.clientY - rect.top) * scaleY

      setMonitors((prev) => {
        const target = prev.find((m) => m.display.id === drag.id)
        if (!target) return prev
        const home = buildLayoutMonitors(displays, {}).find((m) => m.display.id === drag.id)
        const snapped = snapArrangementPosition(
          pointerX - drag.offsetX,
          pointerY - drag.offsetY,
          target.width,
          target.height,
          prev.filter((m) => m.display.id !== drag.id),
          home ? { x: home.x, y: home.y } : { x: target.x, y: target.y },
          CANVAS_BOUNDS,
          { x: target.x, y: target.y }
        )
        const moved = prev.map((m) =>
          m.display.id === drag.id ? { ...m, x: snapped.x, y: snapped.y } : m
        )
        return reorderLayoutMonitors(moved)
      })
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (e.pointerId !== drag.pointerId) return
      setMonitors((prev) => {
        const ordered = reorderLayoutMonitors(prev)
        saveLayoutPositions(layoutToSavedPositions(ordered))
        return ordered
      })
      onLayoutChange?.()
      setDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [drag, displays, onLayoutChange])

  if (displays.length === 0) return <></>

  return (
    <div className="display-arrangement">
      <div className="display-arrangement__head">
        <span className="adw-section-label">Arrangement</span>
        <button
          type="button"
          className="adw-button adw-button--flat display-arrangement__reset"
          onClick={resetToSystem}
        >
          Reset to system layout
        </button>
      </div>
      <p className="adw-caption display-arrangement__hint">
        Drag a monitor and it locks to the edge of another. Numbers are the order Orion uses when
        sending to more than one output: left to right, then top to bottom.
      </p>
      <div
        ref={canvasRef}
        className="display-arrangement__canvas"
        role="img"
        aria-label="Display arrangement preview"
      >
        {monitors.map((monitor) => {
          const d = monitor.display
          const dragging = drag?.id === d.id
          return (
            <div
              key={d.id}
              className={[
                'display-arrangement__monitor',
                dragging ? 'display-arrangement__monitor--dragging' : '',
                d.primary ? 'display-arrangement__monitor--primary' : '',
                displays.length < 2 ? 'display-arrangement__monitor--solo' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: `${(monitor.x / DISPLAY_LAYOUT_CANVAS.width) * 100}%`,
                top: `${(monitor.y / DISPLAY_LAYOUT_CANVAS.height) * 100}%`,
                width: `${(monitor.width / DISPLAY_LAYOUT_CANVAS.width) * 100}%`,
                height: `${(monitor.height / DISPLAY_LAYOUT_CANVAS.height) * 100}%`
              }}
              onPointerDown={(e) => onMonitorPointerDown(monitor, e)}
              role="button"
              tabIndex={0}
              aria-label={`${d.label}, ${formatResolution(d)}, output ${monitor.order}`}
            >
              <span className="display-arrangement__order">{monitor.order}</span>
              <span className="display-arrangement__label">{d.label}</span>
              <span className="display-arrangement__res adw-caption">{formatResolution(d)}</span>
              {d.primary ? (
                <span className="display-arrangement__primary-badge adw-caption">Primary</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
