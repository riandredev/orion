import { useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'

const CLOSE_MS = 200

type AdwAlertDialogProps = {
  open: boolean
  title: string
  body: ReactNode
  cancelLabel?: string
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdwAlertDialog({
  open,
  title,
  body,
  cancelLabel = 'Cancel',
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm
}: AdwAlertDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    if (mounted) {
      setVisible(false)
      const t = window.setTimeout(() => setMounted(false), CLOSE_MS)
      return () => window.clearTimeout(t)
    }
  }, [open, mounted])

  useEffect(() => {
    if (!mounted) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(raf)
      if (el.open) el.close()
    }
  }, [mounted])

  useEffect(() => {
    const el = dialogRef.current
    if (!el || !mounted) return
    const onCancelEvent = (e: Event): void => {
      e.preventDefault()
      if (!busy) onCancel()
    }
    el.addEventListener('cancel', onCancelEvent)
    return () => el.removeEventListener('cancel', onCancelEvent)
  }, [busy, mounted, onCancel])

  if (!mounted) return null

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget && !busy) onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className={
        visible ? 'adw-alert-dialog adw-alert-dialog--visible' : 'adw-alert-dialog adw-alert-dialog--closing'
      }
      aria-labelledby="adw-alert-title"
      aria-describedby="adw-alert-body"
      onClick={onBackdropClick}
    >
      <div className="adw-alert-dialog__frame" onClick={(e) => e.stopPropagation()}>
        <h2 id="adw-alert-title" className="adw-alert-dialog__title">
          {title}
        </h2>
        <div id="adw-alert-body" className="adw-alert-dialog__body adw-caption">
          {body}
        </div>
        <footer className="adw-alert-dialog__actions">
          <button
            type="button"
            className="adw-button adw-button--flat"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              destructive
                ? 'adw-button adw-button--destructive'
                : 'adw-button adw-button--suggested'
            }
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
