import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { displayFileUrl } from '../lib/file-url'
import { cssDimOverlay } from '../../../shared/dim-overlay'
import { projectionContentInsetsPreviewVars } from '../../../shared/projection-content-insets'
import {
  DICTIONARY_TYPOGRAPHY_ELEMENTS,
  projectionTypographyCssVars,
  type DictionaryTypographyElementId
} from '../../../shared/projection-typography'
import { resolveCategoryBackground, useBackgroundSettings } from '../lib/background-settings'
import { useProjectionContentInsetsByCategory } from '../lib/projection-content-insets-settings'
import {
  resetDictionaryPanel,
  resetDictionaryTypographyElement,
  updateDictionaryPanel,
  updateDictionaryTypographyElement,
  useDictionaryTypography,
  useProjectionTypography
} from '../lib/projection-typography-settings'
import {
  PROJECTION_PREVIEW_STAGE_HEIGHT,
  PROJECTION_PREVIEW_STAGE_WIDTH
} from './BackgroundStagePreview'
import { ContentInsetCard } from './ContentInsetCard'
import { CategoryPlacementCard, placedBlockClass, placedBlockStyle } from './CategoryPlacementCard'
import {
  resetDictionaryBlockLayout,
  updateDictionaryBlockAnchor,
  updateDictionaryBlockMargin,
  updateDictionaryBlockMarginSides,
  updateDictionaryBlockWidth,
  useDictionaryBlockLayout
} from '../lib/category-block-layout'
import { LineHeightField, TextPanelFields, TextShadowField, TypeStyleFields } from './TypeStyleFields'

function fileUrl(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  return displayFileUrl(filePath)
}

export function DictionarySettingsPanel(): ReactElement {
  const typography = useProjectionTypography()
  const dictionary = useDictionaryTypography()
  const insets = useProjectionContentInsetsByCategory().dictionary
  const blockLayout = useDictionaryBlockLayout()
  const [selected, setSelected] = useState<DictionaryTypographyElementId>('definition')
  const selectedMeta =
    DICTIONARY_TYPOGRAPHY_ELEMENTS.find((item) => item.id === selected) ?? DICTIONARY_TYPOGRAPHY_ELEMENTS[0]!
  const style = dictionary[selected]
  const backgrounds = useBackgroundSettings()
  const resolved = resolveCategoryBackground('dictionary', backgrounds)
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
    ...projectionTypographyCssVars(typography)
  }

  const hit = (id: DictionaryTypographyElementId): string =>
    id === selected ? 'hymn-style-hit hymn-style-hit--selected' : 'hymn-style-hit'

  return (
    <div className="settings-panel settings-bg">
      <h2 className="settings-panel__title">Dictionary</h2>
      <p className="adw-caption">Type, box, and position for each part of a word study.</p>
      <div className="adw-view-switcher" role="tablist" aria-label="Dictionary slide parts">
        {DICTIONARY_TYPOGRAPHY_ELEMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`dictionary-part-${item.id}`}
            aria-selected={item.id === selected}
            aria-controls="dictionary-part-panel"
            className={
              item.id === selected
                ? 'adw-view-switcher__tab adw-view-switcher__tab--active'
                : 'adw-view-switcher__tab'
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
            id="dictionary-part-panel"
            aria-labelledby={`dictionary-part-${selected}`}
          >
            <TypeStyleFields
              label={selectedMeta.label}
              value={style}
              onChange={(patch) => updateDictionaryTypographyElement(selected, patch)}
              onReset={() => resetDictionaryTypographyElement(selected)}
            />
            <TextPanelFields
              label={`${selectedMeta.label} box`}
              panel={typography.dictionaryPanels[selected]}
              onChange={(patch) => updateDictionaryPanel(selected, patch)}
              onReset={() => resetDictionaryPanel(selected)}
            />
            <CategoryPlacementCard
              blocks={DICTIONARY_TYPOGRAPHY_ELEMENTS.map((item) => ({ id: item.id, label: item.label }))}
              blockId={selected}
              layout={blockLayout}
              onAnchor={updateDictionaryBlockAnchor}
              onMargin={updateDictionaryBlockMargin}
              onMarginSides={updateDictionaryBlockMarginSides}
              onWidth={updateDictionaryBlockWidth}
              onReset={resetDictionaryBlockLayout}
            />
            <TextShadowField category="dictionary" value={typography.textShadow.dictionary} />
          </div>
          <ContentInsetCard category="dictionary" title="Dictionary" />
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
              const id = (event.target as HTMLElement).closest('[data-dictionary-style]')?.getAttribute('data-dictionary-style')
              if (id === 'strongs' || id === 'lemma' || id === 'details' || id === 'definition') setSelected(id)
            }}
          >
            <div className="settings-bg__stage-canvas orion-projection-content-insets" style={canvasStyle}>
              <div className="settings-bg__stage-layer">
                <div className={`dictionary-proj bg-stage-demo__fill${Object.values(blockLayout).some((item) => item.anchor !== 'flow') ? ' proj-place' : ''}`}>
                  <p
                    className={`dictionary-proj__ref ${hit('strongs')} ${placedBlockClass(blockLayout.strongs.anchor)}`}
                    data-dictionary-style="strongs"
                    style={placedBlockStyle(blockLayout.strongs) as CSSProperties}
                  >
                    <span className="dictionary-proj__ref-id">G26</span> · Greek
                  </p>
                  <p
                    className={`dictionary-proj__lemma ${hit('lemma')} ${placedBlockClass(blockLayout.lemma.anchor)}`}
                    data-dictionary-style="lemma"
                    style={placedBlockStyle(blockLayout.lemma) as CSSProperties}
                  >
                    <span className="dictionary-proj__lemma-reading">agapē</span>
                    <svg className="dictionary-proj__lemma-arrow" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="dictionary-proj__lemma-original" dir="auto">
                      ἀγάπη
                    </span>
                  </p>
                  <div
                    className={`dictionary-proj__infobar ${hit('details')} ${placedBlockClass(blockLayout.details.anchor)}`}
                    data-dictionary-style="details"
                    style={placedBlockStyle(blockLayout.details) as CSSProperties}
                  >
                    <p className="dictionary-proj__infobar-seg dictionary-proj__infobar-seg--active">noun</p>
                    <p className="dictionary-proj__infobar-seg">agápē</p>
                    <p className="dictionary-proj__infobar-seg">love</p>
                  </div>
                  <p
                    className={`dictionary-proj__definition ${hit('definition')} ${placedBlockClass(blockLayout.definition.anchor)}`}
                    data-dictionary-style="definition"
                    style={placedBlockStyle(blockLayout.definition) as CSSProperties}
                  >
                    <span className="dictionary-proj__definition-en">
                      Affection, good will, love, benevolence. In the New Testament it is the love of God and of Christ
                      toward people, and the love people owe one another.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          </div>
          <div className="adw-card settings-bg__controls-card">
            <LineHeightField
              category="dictionary"
              value={typography.lineHeight.dictionary}
              label="Definition line height"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
