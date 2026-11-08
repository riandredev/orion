import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getModalPortalRoot } from '../lib/modal-portal-root'
import { AppIcon } from './AppIcon'

export function AdwContextMenu({
  x,
  y,
  onClose,
  children
}: {
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [onClose])

  const portal = getModalPortalRoot()
  const inDialog = portal.id === 'orion-settings-portal'
  const portalRect = portal.getBoundingClientRect()
  const maxLeft = (inDialog ? portalRect.width : window.innerWidth) - 180
  const maxTop = (inDialog ? portalRect.height : window.innerHeight) - 64
  const rawLeft = inDialog ? x - portalRect.left : x
  const rawTop = inDialog ? y - portalRect.top : y

  return createPortal(
    <div
      ref={ref}
      className="adw-context-menu"
      role="menu"
      style={{
        position: inDialog ? 'absolute' : 'fixed',
        left: Math.max(8, Math.min(rawLeft, maxLeft)),
        top: Math.max(8, Math.min(rawTop, maxTop)),
        zIndex: inDialog ? 2 : 80
      }}
    >
      {children}
    </div>,
    portal
  )
}

export function AdwContextMenuItem({
  label,
  destructive = false,
  onSelect
}: {
  label: string
  destructive?: boolean
  onSelect: () => void
}): ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      className={
        destructive ? 'adw-context-menu__item adw-context-menu__item--destructive' : 'adw-context-menu__item'
      }
      onClick={onSelect}
    >
      {destructive ? <AppIcon name="trash" size={16} /> : null}
      <span>{label}</span>
    </button>
  )
}
