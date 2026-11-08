import { useCallback, useEffect, useRef, useState, type ReactElement, type PointerEvent as ReactPointerEvent } from 'react'
import type { LiveFrame } from '../lib/live-deck'
import {
  WEB_BROWSER_USER_AGENT,
  WEB_CONTAIN_FULLSCREEN_SCRIPT,
  WEB_SYNC_INSTALL_SCRIPT
} from '../../../shared/web-browser'
import { subscribeLibraryMedia, type LibraryMediaCommand } from '../lib/library-media-sync'
import { subscribeWebMedia, type WebMediaCommand } from '../lib/web-media-sync'
import { nudgeMediaElement, subscribeDeckMedia } from './PresentationStage'
import { AppIcon } from './AppIcon'
import {
  clampProjectorPanelWidth,
  loadProjectorPanelWidth,
  PROJECTOR_PANEL_WIDTH_MAX,
  PROJECTOR_PANEL_WIDTH_MIN,
  saveProjectorPanelWidth
} from '../lib/projector-panel-width'

export type OutputPreviewMotion = {
  animation: 'crossfade' | 'fade' | 'cut' | 'wipe' | 'push' | 'cover' | 'uncover' | 'split'
  durationMs: number
}

export type OutputOverlayPreview = {
  title: string
  body: string
  backgroundUrl?: string
  backgroundColor?: string
  dimOpacity?: number
  fit?: 'cover' | 'contain'
}

export type OutputPreview = {
  id: string
  label: string
  subtitle: string
  isLive: boolean
  previewUrl?: string
  previewWebUrl?: string
  /** JPEG capture of the actual projection window (same pixels as the display). */
  captureDataUrl?: string
  overlay?: OutputOverlayPreview
  /** Transition played in this card when the output advances. */
  previewMotion?: OutputPreviewMotion
  /** Changes once per projected slide so the card plays that transition once. */
  previewSlideKey?: string
  libraryMedia?: { url: string; kind: 'video' | 'audio'; name: string }
}

type ProjectorPanelProps = {
  open: boolean
  onToggle: () => void
  outputs: OutputPreview[]
  /** Current deck slide on the outputs, so a video can play in the card. */
  liveFrame?: LiveFrame | null
}

function OutputLiveMirror({ frame }: { frame: LiveFrame }): ReactElement {
  const markupRef = useRef<HTMLDivElement>(null)
  const mediaRefs = useRef<(HTMLMediaElement | null)[]>([])

  useEffect(() => {
    const root = markupRef.current
    if (!root) return
    for (const el of root.querySelectorAll('video, audio')) {
      if (!(el instanceof HTMLMediaElement)) continue
      el.muted = true
      el.controls = false
      el.pause()
    }
  }, [frame.markup])

  useEffect(() => {
    let seenEpoch = -1
    return subscribeDeckMedia((command) => {
      if (command.epoch < seenEpoch) return
      seenEpoch = command.epoch
      const el = mediaRefs.current[command.index]
      if (!el) return
      nudgeMediaElement(el, command)
    })
  }, [])

  return (
    <div
      className="projector-preview__deck"
      style={{
        ['--slide-w' as string]: frame.width,
        ['--slide-h' as string]: frame.height
      }}
    >
      <div className="projector-preview__deck-stage">
        <div
          ref={markupRef}
          className="presentation-live__markup"
          dangerouslySetInnerHTML={{ __html: frame.markup }}
        />
        {frame.media.map((media, index) =>
          media.kind === 'video' ? (
            <video
              key={`${index}-${media.src}`}
              ref={(node) => {
                mediaRefs.current[index] = node
              }}
              className="presentation-live__video"
              src={media.src}
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              style={{
                left: `${media.leftPct}%`,
                top: `${media.topPct}%`,
                width: `${media.widthPct}%`,
                height: `${media.heightPct}%`
              }}
            />
          ) : null
        )}
      </div>
    </div>
  )
}

function LibraryOutputPreview({ url }: { url: string }): ReactElement {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let seenEpoch = -1
    let pending: LibraryMediaCommand | null = null
    const apply = (command: LibraryMediaCommand): void => {
      if (command.epoch < seenEpoch) return
      seenEpoch = command.epoch
      pending = command
      el.muted = true
      if (el.readyState >= 1) nudgeMediaElement(el, { ...command, index: 0 })
    }
    const applyPending = (): void => {
      el.muted = true
      if (pending) nudgeMediaElement(el, { ...pending, index: 0 })
    }
    el.addEventListener('loadedmetadata', applyPending)
    el.addEventListener('canplay', applyPending)
    const unsubscribe = subscribeLibraryMedia(apply)
    return () => {
      unsubscribe()
      el.removeEventListener('loadedmetadata', applyPending)
      el.removeEventListener('canplay', applyPending)
    }
  }, [url])

  return (
    <video
      ref={ref}
      className="projector-preview__img"
      src={url}
      muted
      playsInline
      disablePictureInPicture
    />
  )
}

type PreviewWebview = HTMLElement & {
  getWebContentsId: () => number
  executeJavaScript: (code: string) => Promise<unknown>
}

function WebOutputPreview({ url }: { url: string }): ReactElement {
  const ref = useRef<PreviewWebview | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = (): void => {
      const rect = host.getBoundingClientRect()
      setFrame({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height))
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [url])

  useEffect(() => {
    const node = ref.current
    if (!node || frame.width <= 0 || frame.height <= 0) return
    let ready = false
    const mute = (): void => {
      if (!ready) return
      try {
        const webContentsId = node.getWebContentsId()
        if (webContentsId) window.orion.setGuestAudioMuted(webContentsId, true)
      } catch {
        /* guest is not attached yet */
      }
    }
    const onStart = (): void => {
      ready = false
    }
    const onReady = (): void => {
      ready = true
      mute()
      void node
        .executeJavaScript(WEB_CONTAIN_FULLSCREEN_SCRIPT)
        .then(() => node.executeJavaScript(WEB_SYNC_INSTALL_SCRIPT))
        .catch(() => {
          /* guest navigated away */
        })
    }
    const apply = (command: WebMediaCommand): void => {
      if (!ready) return
      mute()
      void node
        .executeJavaScript(`window.__orionWebMedia && window.__orionWebMedia(${JSON.stringify(command)})`)
        .catch(() => {
          /* guest navigated away */
        })
    }
    node.addEventListener('did-start-loading', onStart)
    node.addEventListener('did-stop-loading', onReady)
    const unsubscribe = subscribeWebMedia(apply)
    return () => {
      ready = false
      node.removeEventListener('did-start-loading', onStart)
      node.removeEventListener('did-stop-loading', onReady)
      unsubscribe()
    }
  }, [url, frame.width, frame.height])

  return (
    <div ref={hostRef} className="projector-preview__webhost">
      {frame.width > 0 && frame.height > 0 ? (
        <webview
          ref={ref as never}
          className="projector-preview__webview"
          src={url}
          useragent={WEB_BROWSER_USER_AGENT}
          webpreferences="contextIsolation=yes,autoplayPolicy=no-user-gesture-required"
          style={{ width: frame.width, height: frame.height }}
        />
      ) : null}
    </div>
  )
}

function motionClass(animation: OutputPreviewMotion['animation'], role: 'in' | 'out'): string {
  if (animation === 'fade') return role === 'in' ? 'preview-motion__fade-in' : 'preview-motion__fade-out'
  if (animation === 'crossfade') return role === 'in' ? 'preview-motion__fade-in' : 'preview-motion__fade-out'
  if (animation === 'push') return role === 'in' ? 'preview-motion__push-in' : 'preview-motion__push-out'
  if (animation === 'cover') return role === 'in' ? 'preview-motion__push-in' : ''
  if (animation === 'uncover') return role === 'out' ? 'preview-motion__push-out' : ''
  if (animation === 'wipe') return role === 'in' ? 'preview-motion__wipe' : ''
  if (animation === 'split') return role === 'in' ? 'preview-motion__split' : ''
  return ''
}

function MotionPreview({
  src,
  animation,
  durationMs,
  slideKey
}: {
  src: string
  animation: OutputPreviewMotion['animation']
  durationMs: number
  slideKey: string
}): ReactElement {
  const [current, setCurrent] = useState(src)
  const [previous, setPrevious] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'run' | 'out' | 'in'>('idle')
  const currentRef = useRef(src)
  const shownKey = useRef(slideKey)
  const animatingRef = useRef(false)
  const lockUntil = useRef(0)
  const half = Math.max(1, Math.round(durationMs / 2))
  const sequential = animation === 'fade'

  useEffect(() => {
    if (slideKey !== shownKey.current) {
      shownKey.current = slideKey
      lockUntil.current = 0
    }
    if (src === currentRef.current) return
    const outgoing = currentRef.current
    const now = Date.now()
    currentRef.current = src
    if (animatingRef.current || now < lockUntil.current) {
      setCurrent(src)
      return
    }
    if (!outgoing || durationMs <= 0 || animation === 'cut') {
      setCurrent(src)
      setPrevious(null)
      setPhase('idle')
      return
    }
    lockUntil.current = now + durationMs + 160
    animatingRef.current = true
    setPrevious(outgoing)
    setCurrent(src)
    setPhase(sequential ? 'out' : 'run')
  }, [slideKey, src, animation, durationMs, sequential])

  const ms = sequential && (phase === 'out' || phase === 'in') ? half : durationMs
  const incomingMotion = phase === 'in' || phase === 'run' ? motionClass(animation, 'in') : ''
  const outgoingMotion = phase === 'out' || phase === 'run' ? motionClass(animation, 'out') : ''

  return (
    <div className="preview-fade">
      {previous && phase !== 'in' ? (
        <img
          className={`projector-preview__img preview-fade__layer ${outgoingMotion}`.trim()}
          src={previous}
          alt=""
          style={{ ['--fade-ms' as string]: `${ms}ms` }}
          onAnimationEnd={() => {
            if (phase === 'out') setPhase('in')
            else if (!incomingMotion) {
              animatingRef.current = false
              setPrevious(null)
              setPhase('idle')
            }
          }}
        />
      ) : null}
      <img
        key={`${current}-${phase}`}
        className={`projector-preview__img preview-fade__layer ${incomingMotion}${
          phase === 'out' ? ' preview-fade__layer--hold' : ''
        }`.trim()}
        src={current}
        alt=""
        style={{ ['--fade-ms' as string]: `${ms}ms` }}
        onAnimationEnd={() => {
          if (phase === 'run' || phase === 'in') {
            animatingRef.current = false
            setPrevious(null)
            setPhase('idle')
          }
        }}
      />
    </div>
  )
}

function deckEnterClass(transition: string): string {
  if (transition === 'push' || transition === 'cover') return 'preview-motion__push-in'
  if (transition === 'wipe') return 'preview-motion__wipe'
  if (transition === 'split') return 'preview-motion__split'
  if (transition === 'uncover') return 'preview-motion__uncover'
  return 'preview-fade__deck--in'
}

function DeckFadePreview({ frame, underlay }: { frame: LiveFrame; underlay?: string }): ReactElement {
  const token = `${frame.width}x${frame.height}:${frame.markup}:${frame.media.map((media) => media.src).join('|')}`
  const tokenRef = useRef(token)
  const frameRef = useRef(frame)
  const [previous, setPrevious] = useState<LiveFrame | null>(null)
  const [current, setCurrent] = useState(frame)
  const duration = Math.max(1, frame.durationMs)
  const enterClass = deckEnterClass(current.transition)
  const leaveClass = current.transition === 'push' ? 'preview-motion__push-out' : ''

  useEffect(() => {
    if (token === tokenRef.current) return
    setPrevious(frameRef.current)
    frameRef.current = frame
    tokenRef.current = token
    setCurrent(frame)
  }, [token, frame])

  return (
    <div className="preview-fade">
      {!previous && underlay ? (
        <img className="projector-preview__img preview-fade__layer" src={underlay} alt="" />
      ) : null}
      {previous ? (
        <div className={`preview-fade__deck ${leaveClass}`.trim()}>
          <OutputLiveMirror frame={previous} />
        </div>
      ) : null}
      <div
        key={token}
        className={previous || underlay ? `preview-fade__deck ${enterClass}` : 'preview-fade__deck'}
        style={{ ['--fade-ms' as string]: `${duration}ms` }}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return
          setPrevious(null)
        }}
      >
        <OutputLiveMirror frame={current} />
      </div>
    </div>
  )
}

function OutputCompositePreview({
  captureUrl,
  imageUrl,
  overlay,
  previewMotion,
  slideKey,
  placeholder
}: {
  captureUrl?: string
  imageUrl?: string
  overlay?: OutputOverlayPreview
  previewMotion?: OutputPreviewMotion
  slideKey: string
  placeholder: string
}): ReactElement {
  const [departing, setDeparting] = useState<string | null>(null)
  const prevOverlay = useRef(overlay)
  const prevCapture = useRef(captureUrl)
  const fadeMs = previewMotion && previewMotion.durationMs > 0 ? previewMotion.durationMs : 420

  const heldCapture = prevCapture.current
  if (prevOverlay.current && !overlay && imageUrl && heldCapture && departing !== heldCapture) {
    setDeparting(heldCapture)
  } else if (overlay && departing) {
    setDeparting(null)
  }
  prevOverlay.current = overlay
  if (overlay && captureUrl) prevCapture.current = captureUrl

  useEffect(() => {
    if (!departing) return
    const timer = window.setTimeout(() => setDeparting(null), fadeMs + 80)
    return () => window.clearTimeout(timer)
  }, [departing, fadeMs])

  if (overlay && (captureUrl || imageUrl)) {
    const motion = previewMotion ?? { animation: 'crossfade' as const, durationMs: fadeMs }
    return (
      <MotionPreview
        src={captureUrl ?? imageUrl!}
        animation={motion.animation}
        durationMs={motion.durationMs}
        slideKey={slideKey}
      />
    )
  }

  if (departing && imageUrl) {
    return (
      <>
        <img className="projector-preview__img" src={imageUrl} alt="" />
        <img
          className="projector-preview__img projector-preview__img--capture preview-fade__layer preview-fade__layer--out"
          src={departing}
          alt=""
          style={{ ['--fade-ms' as string]: `${fadeMs}ms` }}
        />
      </>
    )
  }

  if (!overlay && previewMotion && imageUrl) {
    return (
      <MotionPreview
        src={imageUrl}
        animation={previewMotion.animation}
        durationMs={previewMotion.durationMs}
        slideKey={slideKey}
      />
    )
  }

  if (captureUrl && !imageUrl) {
    return <img className="projector-preview__img projector-preview__img--capture" src={captureUrl} alt="" />
  }

  return (
    <>
      {imageUrl ? (
        <img className="projector-preview__img" src={imageUrl} alt="" />
      ) : !overlay ? (
        <span className="projector-preview__placeholder">{placeholder}</span>
      ) : null}
      <div
        className={
          overlay
            ? 'projector-preview__overlay projector-preview__overlay--visible'
            : 'projector-preview__overlay'
        }
        style={
          overlay
            ? {
                backgroundColor: overlay.backgroundColor ?? '#000000',
                backgroundSize: overlay.fit ?? 'cover',
                backgroundImage: overlay.backgroundUrl
                  ? `linear-gradient(rgba(0, 0, 0, ${(overlay.dimOpacity ?? 55) / 100}), rgba(0, 0, 0, ${(overlay.dimOpacity ?? 55) / 100})), url(${JSON.stringify(overlay.backgroundUrl)})`
                  : undefined
              }
            : undefined
        }
      >
        {overlay ? (
          <div className="projector-preview__overlay-content">
            <span className="projector-preview__overlay-title">{overlay.title}</span>
            <span className="projector-preview__overlay-body">{overlay.body}</span>
          </div>
        ) : null}
      </div>
    </>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }): ReactElement {
  return <AppIcon name={direction === 'left' ? 'caretLeft' : 'caretRight'} />
}

export function ProjectorPanel({
  open,
  onToggle,
  outputs,
  liveFrame = null
}: ProjectorPanelProps): ReactElement {
  const [panelWidth, setPanelWidth] = useState(loadProjectorPanelWidth)
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const finishResize = useCallback((width: number) => {
    dragRef.current = null
    setResizing(false)
    document.body.classList.remove('projector-shell--resizing')
    const clamped = clampProjectorPanelWidth(width)
    setPanelWidth(clamped)
    saveProjectorPanelWidth(clamped)
  }, [])

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!open) return
      event.preventDefault()
      dragRef.current = { startX: event.clientX, startWidth: panelWidth }
      setResizing(true)
      document.body.classList.add('projector-shell--resizing')
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [open, panelWidth]
  )

  const onResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const delta = dragRef.current.startX - event.clientX
    setPanelWidth(clampProjectorPanelWidth(dragRef.current.startWidth + delta))
  }, [])

  const onResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startX - event.clientX
      const finalWidth = clampProjectorPanelWidth(dragRef.current.startWidth + delta)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      finishResize(finalWidth)
    },
    [finishResize]
  )

  const onResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelWidth((w) => {
        const next = clampProjectorPanelWidth(w + 12)
        saveProjectorPanelWidth(next)
        return next
      })
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelWidth((w) => {
        const next = clampProjectorPanelWidth(w - 12)
        saveProjectorPanelWidth(next)
        return next
      })
    }
  }, [])

  return (
    <div
      className={`projector-shell ${open ? '' : 'projector-shell--collapsed'}${resizing ? ' projector-shell--resizing' : ''}`}
    >
      {open ? (
        <div
          className="projector-panel__resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize outputs panel"
          aria-valuemin={PROJECTOR_PANEL_WIDTH_MIN}
          aria-valuemax={PROJECTOR_PANEL_WIDTH_MAX}
          aria-valuenow={panelWidth}
          tabIndex={0}
          title={`Drag to resize (${PROJECTOR_PANEL_WIDTH_MIN}–${PROJECTOR_PANEL_WIDTH_MAX}px)`}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={(e) => {
            if (dragRef.current) {
              const delta = dragRef.current.startX - e.clientX
              finishResize(clampProjectorPanelWidth(dragRef.current.startWidth + delta))
            }
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
          onKeyDown={onResizeKeyDown}
        />
      ) : null}
      <button
        type="button"
        className="projector-panel__toggle"
        onClick={onToggle}
        aria-label={open ? 'Hide output previews' : 'Show output previews'}
        aria-expanded={open}
        title={open ? 'Hide outputs' : 'Show outputs'}
      >
        <Chevron direction={open ? 'right' : 'left'} />
      </button>
      <aside
        className="projector-panel"
        aria-label="Projector previews"
        aria-hidden={!open}
        style={open ? { width: panelWidth } : undefined}
      >
        <div className="projector-panel__header">
          <span className="projector-panel__title">Outputs</span>
          <span className="adw-caption">{outputs.length} display(s)</span>
        </div>
        <div className="projector-panel__list">
          {outputs.map((output) => (
            <div key={output.id} className="projector-preview">
              <div className="projector-preview__head">
                <span className="projector-preview__label">{output.label}</span>
                {output.isLive ? (
                  <span className="projector-preview__live">Live</span>
                ) : (
                  <span className="projector-preview__status">Idle</span>
                )}
              </div>
              <div className="projector-preview__screen">
                {output.libraryMedia?.kind === 'video' ? (
                  <LibraryOutputPreview key={output.libraryMedia.url} url={output.libraryMedia.url} />
                ) : output.libraryMedia?.kind === 'audio' ? (
                  <span className="projector-preview__placeholder">{output.libraryMedia.name}</span>
                ) : output.previewWebUrl ? (
                  <WebOutputPreview key={output.previewWebUrl} url={output.previewWebUrl} />
                ) : output.isLive && liveFrame && liveFrame.media.some((media) => media.kind === 'video') ? (
                  <OutputLiveMirror frame={liveFrame} />
                ) : output.captureDataUrl && output.previewMotion && output.previewSlideKey ? (
                  <MotionPreview
                    src={output.captureDataUrl}
                    animation={output.previewMotion.animation}
                    durationMs={output.previewMotion.durationMs}
                    slideKey={output.previewSlideKey}
                  />
                ) : output.captureDataUrl ? (
                  <img
                    className="projector-preview__img projector-preview__img--capture"
                    src={output.captureDataUrl}
                    alt=""
                  />
                ) : output.isLive && liveFrame && liveFrame.durationMs > 0 ? (
                  <DeckFadePreview frame={liveFrame} underlay={output.previewUrl} />
                ) : (
                  <OutputCompositePreview
                    captureUrl={output.captureDataUrl}
                    imageUrl={output.previewUrl}
                    overlay={output.overlay}
                    previewMotion={output.previewMotion}
                    slideKey={output.previewSlideKey ?? output.subtitle}
                    placeholder={output.subtitle}
                  />
                )}
              </div>
              {output.isLive ? (
                <div className="projector-preview__caption adw-caption">{output.subtitle}</div>
              ) : null}
            </div>
          ))}
        </div>
        <p className="projector-panel__hint">Live view of each output.</p>
      </aside>
    </div>
  )
}

export const defaultOutputPreviews: OutputPreview[] = [
  {
    id: 'display-0',
    label: 'Main projector',
    subtitle: 'Nothing on screen',
    isLive: false
  },
  {
    id: 'display-1',
    label: 'Stage monitor',
    subtitle: 'Nothing on screen',
    isLive: false
  }
]
