import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { AppIcon } from './AppIcon'

export type AdwSelectOption<T extends string = string> = {
  value: T
  label: string
}

type AdwSelectProps<T extends string> = {
  value: T
  options: readonly AdwSelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function AdwSelect<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  'aria-label': ariaLabel
}: AdwSelectProps<T>): ReactElement {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onDocKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onDocKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onDocKey)
    }
  }, [open])

  function onTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`adw-select ${open ? 'adw-select--open' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="adw-select__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="adw-select__value">{selected?.label ?? '—'}</span>
        <span className="adw-select__chevron" aria-hidden="true">
          <AppIcon name="caretRight" size={14} />
        </span>
      </button>
      {open && !disabled ? (
        <ul
          id={listId}
          className="adw-select__menu"
          role="listbox"
          aria-label={ariaLabel}
          ref={(node) => {
            if (!node) return
            node.onclick = (event) => {
              event.preventDefault()
              event.stopPropagation()
              const button = (event.target as HTMLElement | null)?.closest('button[data-value]')
              const next = button?.getAttribute('data-value')
              if (!next) return
              onChange(next as T)
              setOpen(false)
            }
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  data-value={opt.value}
                  aria-selected={active}
                  className={
                    active ? 'adw-select__option adw-select__option--active' : 'adw-select__option'
                  }
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
