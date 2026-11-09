import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { cssDimOverlay } from '../../../shared/dim-overlay'
import { projectionContentInsetsPreviewVars } from '../../../shared/projection-content-insets'
import {
  HYMN_TYPOGRAPHY_ELEMENTS,
  hymnTypographyElementId,
  projectionTypographyCssVars,
  type HymnTypographyElementId
} from '../../../shared/projection-typography'
import { resolveCategoryBackground, useBackgroundSettings } from '../lib/background-settings'
import { useProjectionContentInsetsByCategory } from '../lib/projection-content-insets-settings'
import {
  resetHymnPanel,
  resetHymnTypographyElement,
  updateHymnPanel,
  updateHymnTypographyElement,
  useHymnTypography,
  useProjectionTypography
} from '../lib/projection-typography-settings'
import { LineHeightField, TextPanelFields, TextShadowField, TypeStyleFields } from './TypeStyleFields'
import {
  PROJECTION_PREVIEW_STAGE_HEIGHT,
  PROJECTION_PREVIEW_STAGE_WIDTH
} from './BackgroundStagePreview'
import { ContentInsetCard } from './ContentInsetCard'
import { CategoryPlacementCard, placedBlockClass, placedBlockStyle } from './CategoryPlacementCard'
import {
  resetHymnBlockLayout,
  updateHymnBlockAnchor,
  updateHymnBlockMargin,
  updateHymnBlockMarginSides,
  updateHymnBlockWidth,
  useHymnBlockLayout
} from '../lib/category-block-layout'

function fileUrl(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

const HYMN_BLOCKS: { id: HymnTypographyElementId; label: string }[] = [
  { id: 'number', label: 'Hymn number' },
  { id: 'corner', label: 'Verse number' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'author', label: 'Author' }
]

export function HymnsSettingsPanel(): ReactElement {
  const projection = useProjectionTypography()
  const typography = useHymnTypography()
  const lineHeight = projection.lineHeight.hymns
  const insets = useProjectionContentInsetsByCategory().hymns
  const blockLayout = useHymnBlockLayout()
  const backgrounds = useBackgroundSettings()
  const resolved = resolveCategoryBackground('hymns', backgrounds)
  const [selected, setSelected] = useState<HymnTypographyElementId>('lyrics')
  const style = typography[selected]
  const scalerRef = useRef<HTMLDivElement>(null)
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

  const selectedMeta = HYMN_TYPOGRAPHY_ELEMENTS.find((item) => item.id === selected) ?? HYMN_TYPOGRAPHY_ELEMENTS[1]!
  const imageUrl = fileUrl(resolved.imagePath)
  const canvasStyle: CSSProperties = {
    width: PROJECTION_PREVIEW_STAGE_WIDTH,
    height: PROJECTION_PREVIEW_STAGE_HEIGHT,
    transform: `scale(${scale})`,
    backgroundColor: resolved.solidColor,
    backgroundImage: imageUrl
      ? `linear-gradient(${cssDimOverlay(resolved.dimColor, resolved.dimOpacity)}, ${cssDimOverlay(resolved.dimColor, resolved.dimOpacity)}), url(${JSON.stringify(imageUrl)})`
      : undefined,
    backgroundSize: resolved.fit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: 'center',
    ...projectionContentInsetsPreviewVars(insets),
    ...projectionTypographyCssVars(projection)
  }

  const hit = (id: HymnTypographyElementId): string =>
    id === selected ? 'hymn-style-hit hymn-style-hit--selected' : 'hymn-style-hit'

  return (
    <div className="settings-panel settings-bg">
      <h2 className="settings-panel__title">Hymns</h2>
      <p className="adw-caption">Type, box, and position for each part of a hymn slide.</p>
      <div className="adw-view-switcher" role="tablist" aria-label="Hymn slide parts">
        {HYMN_TYPOGRAPHY_ELEMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`hymn-part-${item.id}`}
            aria-selected={item.id === selected}
            aria-controls="hymn-part-panel"
            className={
              item.id === selected ? 'adw-view-switcher__tab adw-view-switcher__tab--active' : 'adw-view-switcher__tab'
            }
            onClick={() => setSelected(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="settings-bg__grid">
        <div className="settings-type__stack">
          <div
            className="adw-card settings-bg__controls-card"
            role="tabpanel"
            id="hymn-part-panel"
            aria-labelledby={`hymn-part-${selected}`}
          >
            <TypeStyleFields
              label={selectedMeta.label}
              value={style}
              onChange={(patch) => updateHymnTypographyElement(selected, patch)}
              onReset={() => resetHymnTypographyElement(selected)}
            />
            <TextPanelFields
              label={`${selectedMeta.label} box`}
              panel={projection.hymnPanels[selected]}
              onChange={(patch) => updateHymnPanel(selected, patch)}
              onReset={() => resetHymnPanel(selected)}
            />
            <CategoryPlacementCard
              blocks={HYMN_BLOCKS}
              blockId={selected}
              layout={blockLayout}
              onAnchor={updateHymnBlockAnchor}
              onMargin={updateHymnBlockMargin}
              onMarginSides={updateHymnBlockMarginSides}
              onWidth={updateHymnBlockWidth}
              onReset={resetHymnBlockLayout}
            />
            <TextShadowField category="hymns" value={projection.textShadow.hymns} />
          </div>
          <ContentInsetCard category="hymns" title="Hymns" />
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
              const target = (event.target as HTMLElement).closest('[data-hymn-style]')
              const id = hymnTypographyElementId(target?.getAttribute('data-hymn-style') ?? '')
              if (id) setSelected(id)
            }}
          >
            <div className="settings-bg__stage-canvas orion-projection-content-insets" style={canvasStyle}>
              <div className="settings-bg__stage-layer">
                <div className={`hymn-proj bg-stage-demo__fill${Object.values(blockLayout).some((item) => item.anchor !== 'flow') ? ' proj-place' : ''}`}>
                  <div className="hymn-proj__top">
                    <button
                      type="button"
                      data-hymn-style="corner"
                      className={`hymn-proj__corner ${hit('corner')} ${placedBlockClass(blockLayout.corner.anchor)}`}
                      style={placedBlockStyle(blockLayout.corner) as CSSProperties}
                    >
                      1 - 2
                    </button>
                    <button
                      type="button"
                      data-hymn-style="number"
                      className={`hymn-proj__heading ${hit('number')} ${placedBlockClass(blockLayout.number.anchor)}`}
                      style={placedBlockStyle(blockLayout.number) as CSSProperties}
                    >
                      69
                    </button>
                  </div>
                  <button
                    type="button"
                    data-hymn-style="lyrics"
                    className={`hymn-proj__lines ${hit('lyrics')} ${placedBlockClass(blockLayout.lyrics.anchor)}`}
                    style={placedBlockStyle(blockLayout.lyrics) as CSSProperties}
                  >
                    <span className="hymn-proj__line">Amazing grace! how sweet the sound,</span>
                    <span className="hymn-proj__line">That saved a wretch like me!</span>
                  </button>
                  <button
                    type="button"
                    data-hymn-style="author"
                    className={`hymn-proj__author ${hit('author')} ${placedBlockClass(blockLayout.author.anchor)}`}
                    style={placedBlockStyle(blockLayout.author) as CSSProperties}
                  >
                    John Newton
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="adw-card settings-bg__controls-card">
          <LineHeightField category="hymns" value={lineHeight} label="Lyric line height" />
        </div>
        </div>
      </div>
    </div>
  )
}
