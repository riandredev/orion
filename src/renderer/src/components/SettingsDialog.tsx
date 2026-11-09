import { useCallback, useEffect, useRef, useState, type ReactElement, type MouseEvent } from 'react'
import type { SettingsSection } from '../navigation'
import { settingsSections } from '../navigation'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { AboutSettingsPanel } from './AboutSettingsPanel'
import { BackgroundsSettingsPanel } from './BackgroundsSettingsPanel'
import { BibleSettingsPanel } from './BibleSettingsPanel'
import { DictionarySettingsPanel } from './DictionarySettingsPanel'
import { DisplaysSettingsPanel } from './DisplaysSettingsPanel'
import { HymnsSettingsPanel } from './HymnsSettingsPanel'
import { LibrariesSettingsPanel } from './LibrariesSettingsPanel'
import { OrganizationSettingsPanel } from './OrganizationSettingsPanel'
import { SequenceSettingsPanel } from './SequenceSettingsPanel'

const CLOSE_MS = 200

type SettingsDialogProps = {
  open: boolean
  onClose: () => void
  section: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

function SettingsPanel({ section }: { section: SettingsSection }): ReactElement {
  switch (section) {
    case 'displays':
      return <DisplaysSettingsPanel />
    case 'backgrounds':
      return <BackgroundsSettingsPanel />
    case 'hymns':
      return <HymnsSettingsPanel />
    case 'bible':
      return <BibleSettingsPanel />
    case 'dictionary':
      return <DictionarySettingsPanel />
    case 'sequence':
      return <SequenceSettingsPanel />
    case 'organization':
      return <OrganizationSettingsPanel />
    case 'libraries':
      return <LibrariesSettingsPanel />
    case 'about':
      return <AboutSettingsPanel />
  }
}

export function SettingsDialog({
  open,
  onClose,
  section,
  onSectionChange
}: SettingsDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [libraryUpdates, setLibraryUpdates] = useState(0)

  const releaseDialog = useCallback(() => {
    const el = dialogRef.current
    if (el?.open) el.close()
  }, [])

  const finishUnmount = useCallback(() => {
    releaseDialog()
    closingRef.current = false
    setMounted(false)
    setVisible(false)
  }, [releaseDialog])

  const beginClose = useCallback(
    (notifyParent = true) => {
      if (closingRef.current) return
      closingRef.current = true
      setVisible(false)
      if (notifyParent) onClose()
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = window.setTimeout(finishUnmount, CLOSE_MS)
    },
    [finishUnmount, onClose]
  )

  useEffect(() => {
    if (open) {
      window.clearTimeout(closeTimerRef.current)
      closingRef.current = false
      setMounted(true)
      return
    }
    if (mounted && visible) beginClose(false)
  }, [open, mounted, visible, beginClose])

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
    const onCancel = (e: Event): void => {
      e.preventDefault()
      beginClose()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [beginClose, mounted])

  useEffect(
    () => () => {
      window.clearTimeout(closeTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (!mounted) return
    const load = (): void => {
      void window.orion
        .listLibraries()
        .then((list) => setLibraryUpdates(list.updates))
        .catch(() => undefined)
    }
    load()
    window.addEventListener('orion-libraries-changed', load)
    return () => window.removeEventListener('orion-libraries-changed', load)
  }, [mounted])

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) beginClose()
  }

  if (!mounted) return null

  const dialogClass = visible
    ? 'settings-dialog settings-dialog--visible'
    : 'settings-dialog settings-dialog--closing'

  return (
    <dialog
      ref={dialogRef}
      className={dialogClass}
      aria-labelledby="settings-dialog-title"
      onClick={onDialogClick}
    >
      <div className="settings-dialog__sheet" onClick={(e) => e.stopPropagation()} role="document">
        <header className="settings-dialog__header">
          <h1 id="settings-dialog-title" className="settings-dialog__heading">
            Settings
          </h1>
          <AdwTooltip text="Close">
            <button
              type="button"
              className="adw-button adw-button--flat adw-button--icon-sm settings-dialog__close"
              onClick={() => beginClose()}
              aria-label="Close settings"
            >
              <AppIcon name="close" size={18} />
            </button>
          </AdwTooltip>
        </header>
        <div className="settings-dialog__body">
          <nav className="settings-dialog__nav" aria-label="Settings sections">
            {settingsSections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.id === section
                    ? 'settings-nav-item settings-nav-item--active'
                    : 'settings-nav-item'
                }
                onClick={() => onSectionChange(item.id)}
              >
                <span>{item.label}</span>
                {item.id === 'libraries' && libraryUpdates > 0 ? (
                  <span className="settings-nav-item__dot" aria-label="Library update available" />
                ) : null}
              </button>
            ))}
          </nav>
          <div className="settings-dialog__content">
            <SettingsPanel section={section} />
          </div>
        </div>
        <div id="orion-settings-portal" className="settings-dialog__portal" />
      </div>
    </dialog>
  )
}
