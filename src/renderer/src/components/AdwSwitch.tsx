import type { ReactElement } from 'react'

type AdwSwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
}

export function AdwSwitch({
  checked,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel
}: AdwSwitchProps): ReactElement {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`adw-switch${checked ? ' adw-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="adw-switch__track" aria-hidden="true">
        <span className="adw-switch__thumb" />
      </span>
    </button>
  )
}
