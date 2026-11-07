import { useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import type { HymnalMeta } from '../../../shared/hymnal-types'
import { AppIcon } from './AppIcon'

const CLOSE_MS = 240

type HymnalsLibraryDialogProps = {
  open: boolean
  hymnals: HymnalMeta[]
  activeId: string
  onClose: () => void
  onSelect: (id: string) => void
  onImportFile: () => void
  onImportFolder: () => void
  onImportBibsoftMdb: () => void
  onAddHymn: () => void
}

export function HymnalsLibraryDialog({
  open,
  hymnals,
  activeId,
  onClose,
  onSelect,
  onImportFile,
  onImportFolder,
  onImportBibsoftMdb,
  onAddHymn
}: HymnalsLibraryDialogProps): ReactElement | null {
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

  if (!mounted) return null

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  const dialogClass = visible
    ? 'bible-library-dialog bible-library-dialog--visible'
    : 'bible-library-dialog bible-library-dialog--closing'

  return (
    <dialog
      ref={dialogRef}
      className={dialogClass}
      aria-labelledby="hymnals-library-title"
      onClick={onDialogClick}
    >
      <div
        className="bible-library-dialog__frame"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="bible-library-dialog__header">
          <div>
            <h2 id="hymnals-library-title" className="bible-library-dialog__title">
              Hymnals
            </h2>
            <p className="adw-caption bible-library-dialog__subtitle">
              Import an Orion package, an .mdb hymnal, or author hymns with [V1] / {'{Refrain}'} headers.
            </p>
          </div>
          <button
            type="button"
            className="adw-button adw-button--flat adw-button--icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <AppIcon name="close" size={16} />
          </button>
        </header>

        <div className="bible-library-dialog__body">
          <div className="bible-library-dialog__toolbar">
            <button type="button" className="adw-button adw-button--suggested" onClick={onAddHymn}>
              Add hymn…
            </button>
            <button type="button" className="adw-button" onClick={onImportBibsoftMdb}>
              Import MDB…
            </button>
            <button type="button" className="adw-button" onClick={onImportFile}>
              Import file…
            </button>
            <button type="button" className="adw-button" onClick={onImportFolder}>
              Import folder…
            </button>
          </div>

          <section className="bible-library-dialog__section">
            <p className="adw-section-label bible-library-dialog__section-label">Installed on this device</p>
            {hymnals.length === 0 ? (
              <p className="adw-caption bible-library-dialog__empty">No hymnals yet — import one above.</p>
            ) : (
              <div className="adw-list-group">
                <div className="adw-list-group__header">
                  <span>Hymnals</span>
                  <span className="adw-caption">{hymnals.length}</span>
                </div>
                <div className="adw-list-box">
                  {hymnals.map((h) => {
                    const active = h.id === activeId
                    return (
                      <div
                        key={h.id}
                        className={active ? 'adw-list-row adw-list-row--current' : 'adw-list-row'}
                      >
                        <button
                          type="button"
                          className="adw-list-row__main bible-library-dialog__row-select"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => {
                            onSelect(h.id)
                            onClose()
                          }}
                        >
                          <span className="adw-list-row__title">{h.label}</span>
                          <span className="adw-list-row__subtitle">
                            {h.hymnCount} hymns · {h.source === 'user' ? 'Saved on this device' : 'Bundled'}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </dialog>
  )
}
