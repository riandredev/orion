import { useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import type { AppUpdateStatus } from '../../../shared/app-update'

const CLOSE_MS = 200

export function UpdatePrompt(): ReactElement | null {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => window.orion.onAppUpdate(setStatus), [])

  useEffect(() => {
    if (status) {
      setMounted(true)
      return
    }
    if (!mounted) return
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [status, mounted])

  useEffect(() => {
    if (!mounted) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      if (el.open) el.close()
    }
  }, [mounted])

  if (!mounted || !status) return null

  const dismiss = (): void => {
    setStatus(null)
    void window.orion.dismissAppUpdate()
  }

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    if (event.target === event.currentTarget && status.phase !== 'downloading') dismiss()
  }

  const title =
    status.phase === 'downloading'
      ? 'Downloading update'
      : status.phase === 'ready'
        ? 'Update ready'
        : status.phase === 'error'
          ? 'Update failed'
          : 'Update available'

  return (
    <dialog
      ref={dialogRef}
      className={
        visible ? 'adw-alert-dialog adw-alert-dialog--visible' : 'adw-alert-dialog adw-alert-dialog--closing'
      }
      aria-labelledby="app-update-title"
      onClick={onBackdropClick}
      onCancel={(event) => {
        event.preventDefault()
        if (status.phase !== 'downloading') dismiss()
      }}
    >
      <div className="adw-alert-dialog__frame" onClick={(event) => event.stopPropagation()}>
        <h2 id="app-update-title" className="adw-alert-dialog__title">
          {title}
        </h2>
        <div className="adw-alert-dialog__body adw-caption">
          {status.phase === 'available' ? (
            <>
              <p>Version {status.version} is available.</p>
              {status.notes ? <p className="app-update__notes">{status.notes}</p> : null}
            </>
          ) : null}
          {status.phase === 'downloading' ? (
            <>
              <p>Downloading version {status.version}.</p>
              <div
                className="adw-progress-bar app-update__progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.percent}
              >
                <span className="adw-progress-bar__fill" style={{ width: `${status.percent}%` }} />
              </div>
            </>
          ) : null}
          {status.phase === 'ready' ? <p>Restart to finish installing version {status.version}.</p> : null}
          {status.phase === 'error' ? <p>{status.message}</p> : null}
        </div>
        <footer className="adw-alert-dialog__actions">
          {status.phase === 'error' ? (
            <button type="button" className="adw-button adw-button--suggested" onClick={dismiss}>
              Close
            </button>
          ) : (
            <button type="button" className="adw-button adw-button--flat" onClick={dismiss}>
              {status.phase === 'downloading' ? 'Cancel' : 'Later'}
            </button>
          )}
          {status.phase === 'available' ? (
            <button
              type="button"
              className="adw-button adw-button--suggested"
              onClick={() => void window.orion.downloadAppUpdate()}
            >
              Download
            </button>
          ) : null}
          {status.phase === 'ready' ? (
            <button
              type="button"
              className="adw-button adw-button--suggested"
              onClick={() => void window.orion.installAppUpdate()}
            >
              Restart
            </button>
          ) : null}
        </footer>
      </div>
    </dialog>
  )
}
