import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { projectionContentInsetsPreviewVars } from '../../../shared/projection-content-insets'
import {
  BIBLE_TYPOGRAPHY_ELEMENTS,
  bibleTypographyElementId,
  projectionTypographyCssVars,
  type BibleTypographyElementId
} from '../../../shared/projection-typography'
import { resolveCategoryBackground, useBackgroundSettings } from '../lib/background-settings'
import { useProjectionContentInsetsByCategory } from '../lib/projection-content-insets-settings'
import {
  resetBiblePanel,
  resetBibleTypographyElement,
  updateBiblePanel,
  updateBibleTypographyElement,
  useBibleTypography,
  useProjectionTypography
} from '../lib/projection-typography-settings'
import {
  PROJECTION_PREVIEW_STAGE_HEIGHT,
  PROJECTION_PREVIEW_STAGE_WIDTH
} from './BackgroundStagePreview'
import { ContentInsetCard } from './ContentInsetCard'
import { LineHeightField, TextPanelFields, TextShadowField, TypeStyleFields } from './TypeStyleFields'

function fileUrl(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

export function BibleSettingsPanel(): ReactElement {
  const typography = useProjectionTypography()
  const bible = useBibleTypography()
  const insets = useProjectionContentInsetsByCategory().bible
  const backgrounds = useBackgroundSettings()
  const resolved = resolveCategoryBackground('bible', backgrounds)
  const [selected, setSelected] = useState<BibleTypographyElementId>('verse')
  const style = bible[selected]
  const scalerRef = useRef<HTMLDivElement>(null)
  const verseRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)

  const updateScale = useCallback(() => {
    const scaler = scalerRef.current
    if (!scaler) return
    const next = scaler.clientWidth / PROJECTION_PREVIEW_STAGE_WIDTH
    setScale(Number.isFinite(next) && next > 0 ? next : 0.25)
  }, [])

  useEffect(() => {
    updateScale()
    const scaler = scalerRef.current
    if (!scaler) return
    const observer = new ResizeObserver(updateScale)
    observer.observe(scaler)
    return () => observer.disconnect()
  }, [updateScale])

  useLayoutEffect(() => {
    const textEl = verseRef.current
    const body = textEl?.parentElement
    if (!textEl || !body) return
    const fit = (): void => {
      const maxHeight = body.clientHeight
      if (maxHeight <= 0 || body.clientWidth <= 0) return
      textEl.style.fontSize = ''
      textEl.style.width = '100%'
      textEl.style.maxWidth = '100%'
      const configured = parseFloat(window.getComputedStyle(textEl).fontSize)
      const minPx = 18
      let size = Number.isFinite(configured) && configured > 0 ? configured : 64
      textEl.style.fontSize = `${size}px`
      const fits = (): boolean =>
        textEl.scrollHeight <= maxHeight + 2 && textEl.scrollWidth <= textEl.clientWidth + 2
      while (size > minPx && !fits()) {
        size -= 2
        textEl.style.fontSize = `${size}px`
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    return () => observer.disconnect()
  }, [typography, insets, resolved, scale])

  const selectedMeta = BIBLE_TYPOGRAPHY_ELEMENTS.find((item) => item.id === selected) ?? BIBLE_TYPOGRAPHY_ELEMENTS[3]!
  const imageUrl = fileUrl(resolved.imagePath)
  const dim = Math.min(95, Math.max(0, resolved.dimOpacity)) / 100
  const canvasStyle: CSSProperties = {
    width: PROJECTION_PREVIEW_STAGE_WIDTH,
    height: PROJECTION_PREVIEW_STAGE_HEIGHT,
    transform: `scale(${scale})`,
    backgroundColor: resolved.solidColor,
    backgroundImage: imageUrl
      ? `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url(${JSON.stringify(imageUrl)})`
      : undefined,
    backgroundSize: resolved.fit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: 'center',
    ...projectionContentInsetsPreviewVars(insets),
    ...projectionTypographyCssVars(typography)
  }

  const hit = (id: BibleTypographyElementId): string =>
    id === selected ? 'hymn-style-hit hymn-style-hit--selected' : 'hymn-style-hit'

  return (
    <div className="settings-panel settings-bg">
      <h2 className="settings-panel__title">Bible</h2>
      <p className="adw-caption">
        Type and margins for scripture. Click a line in the preview to change that element.
      </p>
      <div className="settings-bg__grid">
        <div className="settings-type__stack">
          <div className="adw-card settings-bg__controls-card">
            <TypeStyleFields
              label={selectedMeta.label}
              value={style}
              onChange={(patch) => updateBibleTypographyElement(selected, patch)}
              onReset={() => resetBibleTypographyElement(selected)}
            />
            <TextShadowField category="bible" value={typography.textShadow.bible} />
            <TextPanelFields
              label="Book name box"
              panel={typography.biblePanels.reference}
              onChange={(patch) => updateBiblePanel('reference', patch)}
              onReset={() => resetBiblePanel('reference')}
            />
            <TextPanelFields
              label="Verse box"
              panel={typography.biblePanels.verse}
              onChange={(patch) => updateBiblePanel('verse', patch)}
              onReset={() => resetBiblePanel('verse')}
            />
          </div>
          <ContentInsetCard category="bible" title="Bible" />
        </div>
        <div className="settings-bg__aside">
        <div className="adw-card settings-bg__preview-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">Preview</h3>
            <p className="adw-caption">Selected: {selectedMeta.label}</p>
          </div>
          <div
            ref={scalerRef}
            className="settings-bg__stage-scaler"
            onClick={(event) => {
              const target = (event.target as HTMLElement).closest('[data-bible-style]')
              const id = bibleTypographyElementId(target?.getAttribute('data-bible-style') ?? '')
              if (id) setSelected(id)
            }}
          >
            <div className="settings-bg__stage-canvas orion-projection-content-insets" style={canvasStyle}>
              <div className="settings-bg__stage-layer">
                <div className="bible-proj bg-stage-demo__fill">
                  <div className="bible-proj__top">
                    <button type="button" data-bible-style="reference" className={`bible-proj__location ${hit('reference')}`}>
                      John 3:16
                    </button>
                    <button
                      type="button"
                      data-bible-style="translation"
                      className={`bible-proj__translation ${hit('translation')}`}
                    >
                      King James Version
                    </button>
                  </div>
                  <div className="bible-proj__body">
                    <div ref={verseRef} className="bible-proj__text">
                      <span
                        data-bible-style="verseNumber"
                        className={`bible-proj__verse-num ${hit('verseNumber')}`}
                        role="button"
                        tabIndex={0}
                      >
                        16
                      </span>{' '}
                      <span
                        data-bible-style="verse"
                        className={`bible-proj__verse-words ${hit('verse')}`}
                        role="button"
                        tabIndex={0}
                      >
                        For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him
                        should not perish, but have everlasting life.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="adw-card settings-bg__controls-card">
          <LineHeightField category="bible" value={typography.lineHeight.bible} label="Verse line height" />
        </div>
        </div>
      </div>
    </div>
  )
}
