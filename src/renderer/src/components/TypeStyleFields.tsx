import type { ReactElement } from 'react'
import {
  BIBLE_PANEL_OPACITY_MAX,
  BIBLE_PANEL_OPACITY_MIN,
  HYMN_FONT_SIZE_MAX,
  HYMN_FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  PROJECTION_FONTS,
  PROJECTION_FONT_WEIGHTS,
  TEXT_SHADOW_BLUR_MAX,
  TEXT_SHADOW_BLUR_MIN,
  TEXT_SHADOW_OFFSET_MAX,
  TEXT_SHADOW_OFFSET_MIN,
  TEXT_SHADOW_OPACITY_MAX,
  TEXT_SHADOW_OPACITY_MIN,
  TEXT_SHADOW_SIZE_MAX,
  TEXT_SHADOW_SIZE_MIN,
  type BibleTextAlign,
  type BibleTextPanel,
  type ProjectionLineHeight,
  type ProjectionTextShadow,
  type ProjectionTextStyle,
  type TextShadowStyle
} from '../../../shared/projection-typography'
import {
  resetProjectionLineHeight,
  updateProjectionLineHeight,
  updateProjectionTextShadow,
  resetProjectionTextShadow
} from '../lib/projection-typography-settings'
import { AdwColorPicker, type AdwColorSwatch } from './AdwColorPicker'
import { AdwScale } from './AdwScale'
import { AdwSelect } from './AdwSelect'
import { AdwSwitch } from './AdwSwitch'

const BOX_COLOR_SWATCHES: AdwColorSwatch[] = [
  { color: '#0f1b2e', label: 'Navy' },
  { color: '#000000', label: 'Black' },
  { color: '#141418', label: 'Charcoal' },
  { color: '#1a1625', label: 'Midnight' },
  { color: '#1b241e', label: 'Forest' },
  { color: '#3a2a12', label: 'Brown' }
]

const TEXT_COLOR_SWATCHES: AdwColorSwatch[] = [
  { color: '#ffffff', label: 'White' },
  { color: '#fff9a7', label: 'Soft gold' },
  { color: '#ffd400', label: 'Gold' },
  { color: '#ebebeb', label: 'Light gray' },
  { color: '#d1d1d1', label: 'Gray' },
  { color: '#b8b8b8', label: 'Muted gray' }
]

const ALIGN_OPTIONS: { id: BibleTextAlign; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' }
]

export function TextColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (color: string) => void
}): ReactElement {
  return (
    <div className="settings-bg__field">
      <span className="settings-field__label">Color</span>
      <div className="settings-color">
        <AdwColorPicker
          value={value}
          swatches={TEXT_COLOR_SWATCHES}
          aria-label={`${label} color`}
          onChange={onChange}
        />
        <span className="settings-color__value">{value.toUpperCase()}</span>
      </div>
    </div>
  )
}

export function TextPanelFields({
  label,
  panel,
  onChange,
  onReset
}: {
  label: string
  panel: BibleTextPanel
  onChange: (patch: Partial<BibleTextPanel>) => void
  onReset: () => void
}): ReactElement {
  return (
    <div className="settings-type__block settings-bg__field">
      <div className="settings-bg__field-row">
        <span className="settings-field__label">{label}</span>
        <AdwSwitch
          checked={panel.enabled}
          aria-label={`${label} dimming`}
          onChange={(enabled) => onChange({ enabled })}
        />
      </div>
      <p className="adw-caption">
        {panel.enabled
          ? 'Box behind this text. Turn it off to leave the words on the background.'
          : 'The box is off for this text.'}
      </p>
      {panel.enabled ? (
        <>
          <span className="settings-field__label">Box color</span>
          <AdwColorPicker
            value={panel.color}
            swatches={BOX_COLOR_SWATCHES}
            aria-label={`${label} color`}
            onChange={(color) => onChange({ color })}
          />
          <div className="settings-type__size">
            <AdwScale
              aria-label={`${label} strength`}
              min={BIBLE_PANEL_OPACITY_MIN}
              max={BIBLE_PANEL_OPACITY_MAX}
              step={1}
              value={panel.opacity}
              onChange={(opacity) => onChange({ opacity })}
            />
            <span className="settings-type__size-value">{panel.opacity}</span>
          </div>
        </>
      ) : null}
      <span className="settings-field__label">Text alignment</span>
      <div className="settings-align" role="group" aria-label={`${label} alignment`}>
        {ALIGN_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={
              panel.align === option.id ? 'adw-button adw-button--suggested' : 'adw-button adw-button--flat'
            }
            aria-pressed={panel.align === option.id}
            onClick={() => onChange({ align: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button type="button" className="adw-button" onClick={onReset}>
        Reset {label.toLowerCase()}
      </button>
    </div>
  )
}

export function TypeStyleFields({
  label,
  value,
  onChange,
  onReset
}: {
  label: string
  value: ProjectionTextStyle
  onChange: (patch: Partial<ProjectionTextStyle>) => void
  onReset: () => void
}): ReactElement {
  return (
    <div className="settings-type__block">
      <div className="settings-bg__section-head">
        <h3 className="settings-bg__subtitle">{label}</h3>
      </div>
      <div className="settings-bg__form">
        <div className="settings-bg__field">
          <span className="settings-field__label">Font</span>
          <AdwSelect
            aria-label={`${label} font`}
            value={value.fontId}
            options={PROJECTION_FONTS.map((font) => ({ value: font.id, label: font.label }))}
            onChange={(fontId) => onChange({ fontId })}
          />
        </div>
        <TextColorField label={label} value={value.color} onChange={(color) => onChange({ color })} />
        <div className="settings-bg__field">
          <span className="settings-field__label">Font weight</span>
          <AdwSelect
            aria-label={`${label} font weight`}
            value={String(value.fontWeight)}
            options={PROJECTION_FONT_WEIGHTS.map((item) => ({ value: String(item.value), label: item.label }))}
            onChange={(next) => onChange({ fontWeight: Number(next) as ProjectionTextStyle['fontWeight'] })}
          />
        </div>
        <div className="settings-bg__field">
          <span className="settings-field__label">Font size</span>
          <div className="settings-type__size">
            <AdwScale
              aria-label={`${label} font size`}
              min={HYMN_FONT_SIZE_MIN}
              max={HYMN_FONT_SIZE_MAX}
              step={2}
              value={value.sizePx}
              onChange={(sizePx) => onChange({ sizePx })}
            />
            <span className="settings-type__size-value">{value.sizePx}</span>
          </div>
        </div>
        <button type="button" className="adw-button" onClick={onReset}>
          Reset {label.toLowerCase()}
        </button>
      </div>
    </div>
  )
}

export function LineHeightField({
  category,
  value,
  label = 'Line height'
}: {
  category: keyof ProjectionLineHeight
  value: number
  label?: string
}): ReactElement {
  return (
    <div className="settings-type__block settings-bg__field">
      <span className="settings-field__label">{label}</span>
      <div className="settings-type__size">
        <AdwScale
          aria-label={label}
          min={LINE_HEIGHT_MIN}
          max={LINE_HEIGHT_MAX}
          step={0.02}
          value={value}
          onChange={(next) => updateProjectionLineHeight(category, next)}
        />
        <span className="settings-type__size-value">{value.toFixed(2)}</span>
      </div>
      <button type="button" className="adw-button" onClick={() => resetProjectionLineHeight(category)}>
        Reset line height
      </button>
    </div>
  )
}

function ShadowSlider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  display: string
  onChange: (next: number) => void
}): ReactElement {
  return (
    <div className="settings-type__block settings-bg__field">
      <span className="settings-field__label">{label}</span>
      <div className="settings-type__size">
        <AdwScale aria-label={label} min={min} max={max} step={step} value={value} onChange={onChange} />
        <span className="settings-type__size-value">{display}</span>
      </div>
    </div>
  )
}

export function TextShadowField({
  category,
  value
}: {
  category: keyof ProjectionTextShadow
  value: TextShadowStyle
}): ReactElement {
  const set = (patch: Partial<TextShadowStyle>): void => {
    updateProjectionTextShadow(category, patch)
  }
  return (
    <>
      <ShadowSlider
        label="Shadow X"
        min={TEXT_SHADOW_OFFSET_MIN}
        max={TEXT_SHADOW_OFFSET_MAX}
        step={0.01}
        value={value.x}
        display={`${value.x.toFixed(2)} em`}
        onChange={(x) => set({ x })}
      />
      <ShadowSlider
        label="Shadow Y"
        min={TEXT_SHADOW_OFFSET_MIN}
        max={TEXT_SHADOW_OFFSET_MAX}
        step={0.01}
        value={value.y}
        display={`${value.y.toFixed(2)} em`}
        onChange={(y) => set({ y })}
      />
      <ShadowSlider
        label="Shadow blur"
        min={TEXT_SHADOW_BLUR_MIN}
        max={TEXT_SHADOW_BLUR_MAX}
        step={0.01}
        value={value.blur}
        display={`${value.blur.toFixed(2)} em`}
        onChange={(blur) => set({ blur })}
      />
      <ShadowSlider
        label="Shadow size"
        min={TEXT_SHADOW_SIZE_MIN}
        max={TEXT_SHADOW_SIZE_MAX}
        step={1}
        value={value.size}
        display={`${value.size}%`}
        onChange={(size) => set({ size })}
      />
      <div className="settings-type__block settings-bg__field">
        <span className="settings-field__label">Shadow opacity</span>
        <div className="settings-type__size">
          <AdwScale
            aria-label="Shadow opacity"
            min={TEXT_SHADOW_OPACITY_MIN}
            max={TEXT_SHADOW_OPACITY_MAX}
            step={1}
            value={value.opacity}
            onChange={(opacity) => set({ opacity })}
          />
          <span className="settings-type__size-value">{value.opacity}%</span>
        </div>
        <button type="button" className="adw-button" onClick={() => resetProjectionTextShadow(category)}>
          Reset text shadow
        </button>
      </div>
    </>
  )
}
