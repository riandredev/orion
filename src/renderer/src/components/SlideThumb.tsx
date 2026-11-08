import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { PptxSlideCue } from '../../../shared/pptx-cues'
import {
  loadDeckBytes,
  loadLiveSession,
  peekCachedFrame,
  scheduleFrame,
  type DeckSource
} from '../lib/live-deck'

type DeckBytes = { bytes: Uint8Array; mediaDir: string; mediaFiles: string[] }

function stripEmbeddedMedia(markup: string): string {
  return markup
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '')
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<video\b[^>]*\/?>/gi, '')
    .replace(/<audio\b[^>]*\/?>/gi, '')
}

function readDeckBytes(deckId: string): Promise<DeckBytes | null> {
  if (window.orion?.readPresentationDeckSource) return window.orion.readPresentationDeckSource(deckId)
  return window.orionPresenter.readDeckSource(deckId)
}

export function SlideThumb({
  deckId,
  ext,
  slideIndex,
  cues,
  className
}: {
  deckId: string
  ext: string
  slideIndex: number
  cues?: PptxSlideCue[]
  className?: string
}): ReactElement {
  const cached = peekCachedFrame(deckId, slideIndex, -1)
  const [markup, setMarkup] = useState<string | null>(cached ? stripEmbeddedMedia(cached.markup) : null)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const ready = peekCachedFrame(deckId, slideIndex, -1)
    if (ready) {
      setMarkup(stripEmbeddedMedia(ready.markup))
      return
    }
    let cancelled = false
    void loadDeckBytes(deckId, () => readDeckBytes(deckId))
      .then(async (source) => {
        if (!source || cancelled) return
        const session = await loadLiveSession(deckId, { ...source, ext, cues } satisfies DeckSource)
        const frame = await scheduleFrame(deckId, session, slideIndex, -1, 20 + slideIndex)
        if (!cancelled) setMarkup(frame?.markup ? stripEmbeddedMedia(frame.markup) : null)
      })
      .catch(() => {
        if (!cancelled) setMarkup(null)
      })
    return () => {
      cancelled = true
    }
  }, [cues, deckId, ext, slideIndex])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    for (const el of root.querySelectorAll('video, audio')) {
      if (!(el instanceof HTMLMediaElement)) continue
      el.muted = true
      el.volume = 0
      el.pause()
      el.removeAttribute('autoplay')
    }
  }, [markup])

  return (
    <span
      ref={rootRef}
      className={className ? `presentation-thumb ${className}` : 'presentation-thumb'}
    >
      {markup ? <span dangerouslySetInnerHTML={{ __html: markup }} /> : null}
    </span>
  )
}
