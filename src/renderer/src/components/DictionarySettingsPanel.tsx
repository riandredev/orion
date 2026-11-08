import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
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
import { LineHeightField, TextPanelFields, TextShadowField, TypeStyleFields } from './TypeStyleFields'

function fileUrl(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

export function DictionarySettingsPanel(): ReactElement {
  const typography = useProjectionTypography()
  const dictionary = useDictionaryTypography()
  const insets = useProjectionContentInsetsByCategory().dictionary
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

  return (
    <div className="settings-panel settings-bg">
      <h2 className="settings-panel__title">Dictionary</h2>
      <p className="adw-caption">Each part of a word study has its own font and size.</p>
      <div className="settings-bg__grid">
        <div className="settings-type__stack">
          <div className="adw-card settings-bg__controls-card">
            {DICTIONARY_TYPOGRAPHY_ELEMENTS.map((item) => (
              <TypeStyleFields
                key={item.id}
                label={item.label}
                value={dictionary[item.id as DictionaryTypographyElementId]}
                onChange={(patch) => updateDictionaryTypographyElement(item.id, patch)}
                onReset={() => resetDictionaryTypographyElement(item.id)}
              />
            ))}
            {DICTIONARY_TYPOGRAPHY_ELEMENTS.map((item) => (
              <TextPanelFields
                key={`${item.id}-box`}
                label={`${item.label} box`}
                panel={typography.dictionaryPanels[item.id]}
                onChange={(patch) => updateDictionaryPanel(item.id, patch)}
                onReset={() => resetDictionaryPanel(item.id)}
              />
            ))}
            <TextShadowField category="dictionary" value={typography.textShadow.dictionary} />
          </div>
          <ContentInsetCard category="dictionary" title="Dictionary" />
        </div>
        <div className="settings-bg__aside">
          <div className="adw-card settings-bg__preview-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">Preview</h3>
            <p className="adw-caption">Strong’s number, original word, details, and definition.</p>
          </div>
          <div ref={scalerRef} className="settings-bg__stage-scaler">
            <div className="settings-bg__stage-canvas orion-projection-content-insets" style={canvasStyle}>
              <div className="settings-bg__stage-layer">
                <div className="dictionary-proj bg-stage-demo__fill">
                  <p className="dictionary-proj__ref">
                    <span className="dictionary-proj__ref-id">G26</span> · Greek
                  </p>
                  <p className="dictionary-proj__lemma">
                    <span className="dictionary-proj__lemma-reading">agapē</span>
                    <svg className="dictionary-proj__lemma-arrow" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="dictionary-proj__lemma-original" dir="auto">
                      ἀγάπη
                    </span>
                  </p>
                  <div className="dictionary-proj__infobar">
                    <p className="dictionary-proj__infobar-seg dictionary-proj__infobar-seg--active">noun</p>
                    <p className="dictionary-proj__infobar-seg">agápē</p>
                    <p className="dictionary-proj__infobar-seg">love</p>
                  </div>
                  <p className="dictionary-proj__definition">
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
