import type { ReactElement } from 'react'
import {
  BIBLE_PANEL_OPACITY_MAX,
  BIBLE_PANEL_OPACITY_MIN,
  HYMN_FONT_SIZE_MAX,
  HYMN_FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  PROJECTION_FONTS,
  type BibleTextAlign,
  type BibleTextPanel,
  type ProjectionLineHeight,
  type ProjectionTextStyle
} from '../../../shared/projection-typography'
import {
  resetProjectionLineHeight,
  updateProjectionLineHeight
} from '../lib/projection-typography-settings'
import { AdwColorPicker, type AdwColorSwatch } from './AdwColorPicker'
import { AdwScale } from './AdwScale'
import { AdwSelect } from './AdwSelect'
import { AdwSwitch } from './AdwSwitch'

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
          ? 'Dark panel behind this text. Turn it off to leave the words on the background.'
          : 'The dimmed box is off for this text.'}
      </p>
      {panel.enabled ? (
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
