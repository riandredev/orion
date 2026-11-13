import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { PptxSlideCue } from '../../../shared/pptx-cues'
import {
  activeFrame,
  frameFor,
  liveSlideCount,
  getLiveSession,
  loadDeckBytes,
  loadLiveSession,
  renderCachedFrame,
  type LiveFrame,
  type LiveSession
} from '../lib/live-deck'
import { loadPlaybackSettings } from '../lib/playback-settings'
import { OUTPUT_MEDIA_VOLUME } from '../../../shared/output-audio'

export type DeckSourceLoader = (
  deckId: string
) => Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null>

type PresentationStageProps = {
  deckId: string
  ext: string
  cues?: PptxSlideCue[]
  slideIndex: number
  /** Click build on this slide. 0 is the slide as it first appears. */
  buildStep?: number
  loadSource: DeckSourceLoader
  onSlideCount?: (count: number) => void
  showNotes?: boolean
  /** Play the slide transition. The deck browser stays still. */
  animateTransitions?: boolean
  /** This stage is the playback clock for outputs. */
  drivePlayback?: boolean
}

type DeckMediaAction = 'play' | 'pause' | 'seek'

export type DeckMediaCommand = { action: DeckMediaAction; index: number; time: number; epoch: number }

let mediaEpochCounter = 0

/** Move a follower clip onto the preview clock without a hard seek on every tick. */
export function nudgeMediaElement(el: HTMLMediaElement, command: DeckMediaCommand): void {
  if (command.action === 'seek' || command.action === 'pause') {
    if (Number.isFinite(command.time) && Math.abs(command.time - (el.currentTime || 0)) > 0.05) {
      try {
        el.currentTime = command.time
      } catch {
        /* not seekable yet */
      }
    }
    el.playbackRate = 1
    if (command.action === 'pause') el.pause()
    else if (el.paused) void el.play().catch(() => {})
    return
  }
  const drift = command.time - (el.currentTime || 0)
  if (Number.isFinite(drift)) {
    if (Math.abs(drift) > 0.3) {
      try {
        el.currentTime = command.time
      } catch {
        /* not seekable yet */
      }
      el.playbackRate = 1
    } else if (drift > 0.06) {
      el.playbackRate = 1.06
    } else if (drift < -0.06) {
      el.playbackRate = 0.96
    } else {
      el.playbackRate = 1
    }
  }
  if (command.action === 'pause') {
    el.playbackRate = 1
    el.pause()
  } else if (command.action === 'play' && el.paused) {
    void el.play().catch(() => {})
  }
}

const mediaListeners = new Set<(command: DeckMediaCommand) => void>()

export function subscribeDeckMedia(listener: (command: DeckMediaCommand) => void): () => void {
  mediaListeners.add(listener)
  return () => {
    mediaListeners.delete(listener)
  }
}

function publishDeckMedia(action: DeckMediaAction, index: number, time: number, epoch: number): void {
  const command = { action, index, time, epoch }
  for (const listener of mediaListeners) listener(command)
  const sync = window.orion?.syncDeckMedia ?? window.orionPresenter?.syncDeckMedia
  sync?.(command)
}

function DeckMedia({
  kind,
  src,
  index,
  style,
  drivePlayback,
  autoPlay
}: {
  kind: 'audio' | 'video'
  src: string
  index: number
  style?: { left: string; top: string; width: string; height: string }
  /** Preview clock. Followers only listen. */
  drivePlayback: boolean
  autoPlay: boolean
}): ReactElement {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const [audible, setAudible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const silence = (): void => {
      el.muted = true
      el.volume = 0
    }
    silence()
    if (!drivePlayback) {
      let seenEpoch = -1
      let pending: DeckMediaCommand | null = null
      const apply = (command: DeckMediaCommand): void => {
        if (command.index !== index || command.epoch < seenEpoch) return
        seenEpoch = command.epoch
        pending = command
        silence()
        if (el.readyState >= 1) nudgeMediaElement(el, command)
      }
      const applyPending = (): void => {
        silence()
        if (pending) nudgeMediaElement(el, pending)
      }
      const offLocal = subscribeDeckMedia(apply)
      const offPresenter = window.orionPresenter?.onDeckMedia?.(apply)
      el.addEventListener('loadedmetadata', applyPending)
      el.addEventListener('canplay', applyPending)
      el.addEventListener('volumechange', silence)
      void window.orionPresenter?.currentDeckMedia?.().then((command) => {
        if (command) apply(command)
      })
      return () => {
        offLocal()
        offPresenter?.()
        el.removeEventListener('loadedmetadata', applyPending)
        el.removeEventListener('canplay', applyPending)
        el.removeEventListener('volumechange', silence)
        el.pause()
        el.muted = true
        el.volume = 0
        el.removeAttribute('src')
        el.src = ''
        try {
          el.load()
        } catch {
          /* already detached */
        }
      }
    }

    const epoch = ++mediaEpochCounter
    let armed = false
    let clock = 0
    const arm = (): void => {
      armed = true
    }
    const sendClock = (): void => {
      if (el.paused) return
      publishDeckMedia('play', index, el.currentTime || 0, epoch)
    }
    const startClock = (): void => {
      sendClock()
      window.clearInterval(clock)
      clock = window.setInterval(sendClock, 160)
    }
    const stopClock = (): void => {
      window.clearInterval(clock)
    }
    const unmute = (): void => {
      el.muted = false
      if (el.volume === 0 || el.volume === 1) el.volume = OUTPUT_MEDIA_VOLUME
      setAudible(true)
    }
    el.muted = true
    const onPause = (): void => {
      stopClock()
      if (!armed) return
      publishDeckMedia('pause', index, el.currentTime || 0, epoch)
    }
    const onSeeked = (): void => {
      if (!armed) return
      publishDeckMedia(el.paused ? 'pause' : 'seek', index, el.currentTime || 0, epoch)
    }
    const onOutputStopped = (): void => {
      el.pause()
    }
    el.addEventListener('pointerdown', arm, true)
    el.addEventListener('click', arm, true)
    el.addEventListener('keydown', arm, true)
    el.addEventListener('playing', startClock)
    el.addEventListener('playing', unmute)
    el.addEventListener('pause', onPause)
    el.addEventListener('seeked', onSeeked)
    window.addEventListener('orion-pause-local-media', onOutputStopped)
    unmute()
    if (!el.paused) startClock()
    return () => {
      armed = false
      stopClock()
      window.removeEventListener('orion-pause-local-media', onOutputStopped)
      el.removeEventListener('pointerdown', arm, true)
      el.removeEventListener('click', arm, true)
      el.removeEventListener('keydown', arm, true)
      el.removeEventListener('playing', startClock)
      el.removeEventListener('playing', unmute)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('seeked', onSeeked)
      el.muted = true
      el.volume = 0
    }
  }, [drivePlayback, index, src])

  if (kind === 'audio') {
    return (
      <audio
        ref={ref}
        className="presentation-live__audio"
        src={src}
        autoPlay={autoPlay}
        muted={!drivePlayback || !audible}
        controls={drivePlayback}
      />
    )
  }
  return (
    <video
      ref={ref}
      className="presentation-live__video"
      src={src}
      autoPlay={autoPlay}
      muted={!drivePlayback || !audible}
      controls={drivePlayback}
      playsInline
      disablePictureInPicture
      style={style}
    />
  )
}

export function PresentationStage({
  deckId,
  ext,
  cues,
  slideIndex,
  buildStep = 0,
  loadSource,
  onSlideCount,
  showNotes = false,
  animateTransitions = false,
  drivePlayback = false
}: PresentationStageProps): ReactElement {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState<LiveFrame | null>(null)
  const [autoplayMedia, setAutoplayMedia] = useState(() => loadPlaybackSettings().autoplayPresentationMedia)
  const markupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const existing = getLiveSession(deckId)
    if (existing) {
      setSession(existing)
      setError(null)
      onSlideCount?.(liveSlideCount(existing))
      return
    }
    setSession(null)
    setError(null)
    void loadDeckBytes(deckId, () => loadSource(deckId)).then(async (source) => {
      if (!source || cancelled) {
        if (!cancelled) setError('Could not open the presentation file.')
        return
      }
      try {
        const opened = await loadLiveSession(deckId, { ...source, cues, ext })
        if (cancelled) return
        setSession(opened)
        onSlideCount?.(liveSlideCount(opened))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open the presentation.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [cues, deckId, ext, loadSource, onSlideCount])

  useEffect(() => {
    if (!session) return
    setFrame(renderCachedFrame(deckId, slideIndex, buildStep) ?? frameFor(session, slideIndex, buildStep))
  }, [buildStep, deckId, session, slideIndex])

  useEffect(() => {
    const sync = (): void => setAutoplayMedia(loadPlaybackSettings().autoplayPresentationMedia)
    window.addEventListener('orion-playback-settings', sync)
    window.addEventListener('orion-profile-applied', sync)
    return () => {
      window.removeEventListener('orion-playback-settings', sync)
      window.removeEventListener('orion-profile-applied', sync)
    }
  }, [])

  useEffect(() => {
    const root = markupRef.current
    if (!root) return
    const silence = (): void => {
      for (const el of root.querySelectorAll('video, audio')) {
        if (!(el instanceof HTMLMediaElement)) continue
        el.muted = true
        el.volume = 0
        el.pause()
        el.removeAttribute('autoplay')
      }
    }
    silence()
    const observer = new MutationObserver(silence)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [frame])

  if (error) return <p className="adw-caption presentation-workspace__error">{error}</p>
  if (!frame) {
    return (
      <div className="presentation-stage-empty" role="status">
        <span className="adw-spinner adw-spinner--sm" aria-hidden />
      </div>
    )
  }

  const motion =
    !animateTransitions ||
    frame.transition === 'none' ||
    frame.transition === 'cut' ||
    frame.durationMs <= 0
      ? undefined
      : `presentation-motion presentation-motion--${frame.transition}${frame.dir ? ` presentation-motion--${frame.dir}` : ''}`

  return (
    <div className="presentation-live">
      <div className="presentation-live__fit">
      <div
        key={`${slideIndex}-${buildStep}`}
        className={motion ? `presentation-live__stage ${motion}` : 'presentation-live__stage'}
        style={{
          aspectRatio: `${frame.width} / ${frame.height}`,
          ['--slide-w' as string]: frame.width,
          ['--slide-h' as string]: frame.height,
          ['--motion-ms' as string]: `${frame.durationMs}ms`
        }}
      >
        <div
          ref={markupRef}
          className="presentation-live__markup"
          dangerouslySetInnerHTML={{ __html: frame.markup }}
        />
        {frame.media.map((media, index) => (
          <DeckMedia
            key={`${media.kind}-${index}-${media.src}`}
            kind={media.kind}
            src={media.src}
            index={index}
            style={
              media.kind === 'audio'
                ? undefined
                : {
                    left: `${media.leftPct}%`,
                    top: `${media.topPct}%`,
                    width: `${media.widthPct}%`,
                    height: `${media.heightPct}%`
                  }
            }
            drivePlayback={drivePlayback}
            autoPlay={drivePlayback && autoplayMedia}
          />
        ))}
      </div>
      </div>
      {showNotes ? <p className="presentation-live__notes adw-caption">{frame.notes || 'No speaker notes.'}</p> : null}
    </div>
  )
}

export function projectedFrame(deckId: string, slideIndex: number, buildStep = 0): LiveFrame | null {
  return activeFrame(deckId, slideIndex, buildStep)
}
