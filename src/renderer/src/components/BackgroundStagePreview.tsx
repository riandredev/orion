import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { cssDimOverlay } from '../../../shared/dim-overlay'
import type { BackgroundCategoryId, BackgroundFit } from '../lib/background-settings'
import {
  getProjectionContentInsetsForCategory,
  useProjectionContentInsetsByCategory
} from '../lib/projection-content-insets-settings'
import { useProjectionStagePreviewFit } from '../lib/use-projection-stage-preview-fit'
import {
  projectionContentInsetsPreviewVars,
  type ProjectionContentInsetCategory,
  type ProjectionContentInsetsVmin
} from '../../../shared/projection-content-insets'

export const PROJECTION_PREVIEW_STAGE_WIDTH = 1920
export const PROJECTION_PREVIEW_STAGE_HEIGHT = 1080

type BackgroundStagePreviewProps = {
  category: BackgroundCategoryId
  backgroundColor: string
  backgroundImageUrl?: string | null
  dimOpacity: number
  dimColor?: string
  fit: BackgroundFit
  contentInsets?: ProjectionContentInsetsVmin
  /** When false, parent provides sizing; canvas still renders at 1920×1080. */
  scaled?: boolean
}

function insetCategoryForBackground(category: BackgroundCategoryId): ProjectionContentInsetCategory {
  if (category === 'hymns') return 'hymns'
  if (category === 'dictionary') return 'dictionary'
  return 'bible'
}

function stageBackgroundStyle(
  backgroundColor: string,
  backgroundImageUrl: string | null | undefined,
  dimOpacity: number,
  dimColor: string,
  fit: BackgroundFit
): CSSProperties {
  const veil = cssDimOverlay(dimColor, dimOpacity)
  return {
    backgroundColor,
    backgroundSize: fit,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundImage: backgroundImageUrl
      ? `linear-gradient(${veil}, ${veil}), url(${JSON.stringify(backgroundImageUrl)})`
      : undefined
  }
}

function DefaultsStageDemo(): ReactElement {
  return (
    <div className="bg-stage-demo bg-stage-demo--defaults">
      <p className="bg-stage-demo__defaults-caption">Default backdrop</p>
      <p className="bg-stage-demo__defaults-hint">
        Bible, Hymns, and Dictionary use this when set to inherit.
      </p>
    </div>
  )
}

function BibleStageDemo(): ReactElement {
  return (
    <div className="bible-proj bg-stage-demo__fill">
      <div className="bible-proj__top">
        <p className="bible-proj__location">John:3:16</p>
        <p className="bible-proj__translation">King James Version</p>
      </div>
      <div className="bible-proj__body">
        <p className="bible-proj__text">
          <span className="bible-proj__verse-num">16</span>
          <span className="bible-proj__verse-words">
            For God so loved the world, that he gave his only begotten Son, that whosoever believeth
            in him should not perish, but have everlasting life.
          </span>
        </p>
      </div>
    </div>
  )
}

function HymnStageDemo(): ReactElement {
  return (
    <div className="hymn-proj bg-stage-demo__fill">
      <div className="hymn-proj__top">
        <span className="hymn-proj__corner">1</span>
        <p className="hymn-proj__heading">69</p>
      </div>
      <div className="hymn-proj__lines">
        <p className="hymn-proj__line">Amazing grace! how sweet the sound,</p>
        <p className="hymn-proj__line">That saved a wretch like me!</p>
      </div>
      <p className="hymn-proj__author">John Newton</p>
    </div>
  )
}

function DictionaryStageDemo(): ReactElement {
  return (
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
      <div className="dictionary-proj__infobar" role="group" aria-label="Lexicon details">
        <p className="dictionary-proj__infobar-seg dictionary-proj__infobar-seg--active">noun</p>
        <p className="dictionary-proj__infobar-seg">agápē</p>
        <p className="dictionary-proj__infobar-seg">love</p>
      </div>
      <p className="dictionary-proj__definition">
        <span className="dictionary-proj__definition-en">
          Affection, good will, love, benevolence; the love of God toward man and of man toward God.
        </span>
      </p>
    </div>
  )
}

function StageDemo({ category }: { category: BackgroundCategoryId }): ReactElement | null {
  if (category === 'defaults') return <DefaultsStageDemo />
  if (category === 'bible') return <BibleStageDemo />
  if (category === 'hymns') return <HymnStageDemo />
  if (category === 'dictionary') return <DictionaryStageDemo />
  return null
}

export function BackgroundStagePreview({
  category,
  backgroundColor,
  backgroundImageUrl,
  dimOpacity,
  dimColor = '#000000',
  fit,
  contentInsets,
  scaled = true
}: BackgroundStagePreviewProps): ReactElement {
  const insetsByCategory = useProjectionContentInsetsByCategory()
  const resolvedInsets =
    contentInsets ??
    insetsByCategory[insetCategoryForBackground(category)] ??
    getProjectionContentInsetsForCategory('bible')
  const insetCss = projectionContentInsetsPreviewVars(resolvedInsets) as CSSProperties

  const scalerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)

  const layoutKey = `${resolvedInsets.top}-${resolvedInsets.right}-${resolvedInsets.bottom}-${resolvedInsets.left}-${category}-${backgroundImageUrl ?? ''}`

  useProjectionStagePreviewFit(canvasRef, category, layoutKey)

  const updateScale = useCallback(() => {
    const scaler = scalerRef.current
    if (!scaler) return
    const next = scaler.clientWidth / PROJECTION_PREVIEW_STAGE_WIDTH
    setScale(Number.isFinite(next) && next > 0 ? next : 0.25)
  }, [])

  useEffect(() => {
    if (!scaled) return
    updateScale()
    const scaler = scalerRef.current
    if (!scaler) return
    const ro = new ResizeObserver(updateScale)
    ro.observe(scaler)
    return () => ro.disconnect()
  }, [scaled, updateScale])

  const canvasStyle: CSSProperties = {
    width: PROJECTION_PREVIEW_STAGE_WIDTH,
    height: PROJECTION_PREVIEW_STAGE_HEIGHT,
    transform: scaled ? `scale(${scale})` : undefined,
    ...stageBackgroundStyle(backgroundColor, backgroundImageUrl, dimOpacity, dimColor ?? '#000000', fit),
    ...insetCss
  }

  const canvas = (
    <div
      ref={canvasRef}
      className="settings-bg__stage-canvas orion-projection-content-insets"
      style={canvasStyle}
    >
      <div className="settings-bg__stage-layer" aria-hidden>
        <StageDemo category={category} />
      </div>
    </div>
  )

  if (!scaled) {
    return canvas
  }

  return (
    <div ref={scalerRef} className="settings-bg__stage-scaler">
      {canvas}
    </div>
  )
}
