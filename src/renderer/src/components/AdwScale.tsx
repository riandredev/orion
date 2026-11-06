import type { CSSProperties, ReactElement } from 'react'

type AdwScaleProps = {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
  /** Color for the filled portion of the track (GtkScale highlight). */
  fillColor?: string
  /** Full-spectrum hue track (custom color dialog). */
  variant?: 'default' | 'hue'
}

function clampProgress(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

export function AdwScale({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
  fillColor,
  variant = 'default'
}: AdwScaleProps): ReactElement {
  const pct = clampProgress(value, min, max)
  const filled = true
  const style = {
    ['--adw-scale-pct' as string]: `${pct}%`,
    ...(fillColor ? { ['--adw-scale-fill' as string]: fillColor } : {})
  } as CSSProperties

  return (
    <div
      className={`adw-scale ${filled ? 'adw-scale--filled' : ''} ${
        variant === 'hue' ? 'adw-scale--hue' : ''
      } ${className}`.trim()}
      style={style}
    >
      <input
        type="range"
        className="adw-scale__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
