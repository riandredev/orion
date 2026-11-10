import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { createPortal } from 'react-dom'
import { getModalPortalRoot } from '../lib/modal-portal-root'
import { AppIcon } from './AppIcon'

export type AdwSelectOption<T extends string = string> = {
  value: T
  label: string
  icon?: ReactNode
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const trigger = rootRef.current?.querySelector('button')
      const portal = getModalPortalRoot()
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const portalRect = portal.getBoundingClientRect()
      const menuHeight = Math.min(240, options.length * 32 + 8)
      const spaceBelow = portalRect.bottom - rect.bottom
      const openUp = spaceBelow < menuHeight + 8 && rect.top - portalRect.top > spaceBelow
      setMenuStyle({
        position: 'absolute',
        left: rect.left - portalRect.left,
        width: rect.width,
        top: openUp
          ? Math.max(8, rect.top - portalRect.top - menuHeight - 4)
          : rect.bottom - portalRect.top + 4,
        right: 'auto',
        bottom: 'auto',
        zIndex: 2
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onDocPointer = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onDocKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onDocKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onDocKey)
    }
  }, [open])

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((current) => !current)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
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
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="adw-select__value">
          {selected?.icon ? <span className="adw-select__icon">{selected.icon}</span> : null}
          <span className="adw-select__label">{selected?.label ?? '—'}</span>
        </span>
        <span className="adw-select__chevron" aria-hidden="true">
          <AppIcon name="caretRight" size={14} />
        </span>
      </button>
      {open && !disabled
        ? createPortal(
            <ul
              id={listId}
              ref={menuRef}
              className="adw-select__menu adw-select__menu--popover"
              role="listbox"
              aria-label={ariaLabel}
              style={menuStyle}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {options.map((opt) => {
                const active = opt.value === value
                return (
                  <li key={opt.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={
                        active ? 'adw-select__option adw-select__option--active' : 'adw-select__option'
                      }
                      onClick={() => {
                        onChange(opt.value)
                        setOpen(false)
                      }}
                    >
                      {opt.icon ? <span className="adw-select__icon">{opt.icon}</span> : null}
                      <span className="adw-select__label">{opt.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>,
            getModalPortalRoot()
          )
        : null}
    </div>
  )
}
