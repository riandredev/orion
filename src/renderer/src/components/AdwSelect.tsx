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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  // A body portal would render underneath a native popover in the top layer.
  const parentPopover = open ? rootRef.current?.closest<HTMLElement>('[popover]') : null
  const portalRoot = open ? parentPopover ?? getModalPortalRoot() : null

  useLayoutEffect(() => {
    if (!portalRoot) return
    const place = (): void => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const portalRect = portalRoot.getBoundingClientRect()
      const menuHeight = Math.min(240, options.length * 32 + 8)
      const spaceBelow = (parentPopover ? window.innerHeight : portalRect.bottom) - rect.bottom
      const spaceAbove = rect.top - (parentPopover ? 0 : portalRect.top)
      const openUp = spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow
      const maxHeight = parentPopover ? Math.max(0, Math.min(240, (openUp ? spaceAbove : spaceBelow) - 8)) : undefined
      setMenuStyle({
        position: 'absolute',
        left: rect.left - portalRect.left,
        width: rect.width,
        top: openUp
          ? parentPopover
            ? rect.top - portalRect.top - Math.min(menuHeight, maxHeight ?? menuHeight) - 4
            : Math.max(8, rect.top - portalRect.top - menuHeight - 4)
          : rect.bottom - portalRect.top + 4,
        maxHeight,
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
  }, [portalRoot, parentPopover, options.length])

  useEffect(() => {
    if (!open) return
    const onDocPointer = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onDocKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (parentPopover) {
        event.preventDefault()
        triggerRef.current?.focus()
      }
      setOpen(false)
    }
    const onPopoverToggle = (): void => {
      if (!parentPopover?.matches(':popover-open')) setOpen(false)
    }
    parentPopover?.addEventListener('toggle', onPopoverToggle)
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onDocKey)
    return () => {
      parentPopover?.removeEventListener('toggle', onPopoverToggle)
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onDocKey)
    }
  }, [open, parentPopover])

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
        ref={triggerRef}
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
      {portalRoot && !disabled
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
                        if (parentPopover) triggerRef.current?.focus()
                      }}
                    >
                      {opt.icon ? <span className="adw-select__icon">{opt.icon}</span> : null}
                      <span className="adw-select__label">{opt.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>,
            portalRoot
          )
        : null}
    </div>
  )
}
