import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'
import {
  groupOnlineTranslationsByLanguage,
  type OnlineBibleTranslation
} from '../../../shared/bible-online'
import type { InstalledBibleInfo } from '../../../shared/bible-types'
import { listOnlineBibleTranslations } from '../lib/bible-library-api'
import { AdwAlertDialog } from './AdwAlertDialog'
import { AppIcon } from './AppIcon'

const CLOSE_MS = 240

type CatalogPhase = 'loading' | 'ready' | 'unavailable'

const FORMAT_LABEL: Record<InstalledBibleInfo['format'], string> = {
  'orion-json': 'Orion JSON',
  usfm: 'USFM',
  'zefania-xml': 'Zefania XML'
}

type BibleLibraryDialogProps = {
  open: boolean
  bibles: InstalledBibleInfo[]
  activeId: string
  online: boolean
  onClose: () => void
  onImport: () => Promise<InstalledBibleInfo | null>
  onDownload: (translationId: string) => Promise<InstalledBibleInfo>
  onRemove: (id: string) => Promise<boolean>
  onSelect: (id: string) => void
}

function isTranslationInstalled(
  installed: InstalledBibleInfo[],
  translationId: string
): boolean {
  return installed.some((b) => b.catalogSourceId === translationId)
}

export function BibleLibraryDialog({
  open,
  bibles,
  activeId,
  online,
  onClose,
  onImport,
  onDownload,
  onRemove,
  onSelect
}: BibleLibraryDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>(() =>
    online ? 'loading' : 'unavailable'
  )
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [onlineCatalog, setOnlineCatalog] = useState<OnlineBibleTranslation[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string } | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const finishUnmount = useCallback(() => {
    const el = dialogRef.current
    if (el?.open) el.close()
    closingRef.current = false
    setMounted(false)
    setVisible(false)
  }, [])

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
    if (!mounted || !visible) return
    if (!online) {
      setCatalogPhase('unavailable')
      setCatalogError(null)
      return
    }

    let cancelled = false
    setCatalogPhase('loading')
    setCatalogError(null)
    void listOnlineBibleTranslations()
      .then((items) => {
        if (cancelled) return
        setOnlineCatalog(items)
        setCatalogPhase('ready')
      })
      .catch((e) => {
        if (cancelled) return
        setCatalogError(e instanceof Error ? e.message : 'Could not reach the catalog.')
        setCatalogPhase('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [mounted, visible, online])

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) beginClose()
  }

  const availableOnline = useMemo(
    () => onlineCatalog.filter((t) => !isTranslationInstalled(bibles, t.id)),
    [onlineCatalog, bibles]
  )

  const filteredOnline = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    if (!q) return availableOnline
    return availableOnline.filter((t) => {
      const haystack = [
        t.englishName,
        t.name,
        t.shortName,
        t.language,
        t.languageName ?? '',
        t.languageEnglishName ?? ''
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [availableOnline, catalogSearch])

  const groupedOnline = useMemo(
    () => groupOnlineTranslationsByLanguage(filteredOnline),
    [filteredOnline]
  )

  async function handleImport(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const added = await onImport()
      if (added) onSelect(added.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(translationId: string): Promise<void> {
    if (downloadingId) return
    setError(null)
    setDownloadingId(translationId)
    try {
      const added = await onDownload(translationId)
      onSelect(added.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoveBusy(true)
    setError(null)
    try {
      const ok = await onRemove(removeTarget.id)
      if (!ok) setError('Could not remove that Bible.')
      else setRemoveTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed.')
    } finally {
      setRemoveBusy(false)
    }
  }

  if (!mounted) return null

  const dialogClass = visible
    ? 'bible-library-dialog bible-library-dialog--visible'
    : 'bible-library-dialog bible-library-dialog--closing'

  const searchActive = catalogSearch.trim().length > 0
  const catalogReady = catalogPhase === 'ready'
  const catalogSummary =
    catalogReady && onlineCatalog.length > 0
      ? `${onlineCatalog.length.toLocaleString()} translations · ${groupOnlineTranslationsByLanguage(onlineCatalog).length.toLocaleString()} languages`
      : null

  return (
    <>
    <dialog
      ref={dialogRef}
      className={dialogClass}
      aria-labelledby="bible-library-title"
      onClick={onDialogClick}
    >
      <div
        className="bible-library-dialog__frame"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="bible-library-dialog__header">
          <div>
            <h2 id="bible-library-title" className="bible-library-dialog__title">
              Bible translations
            </h2>
            <p className="adw-caption bible-library-dialog__subtitle">
              Download from the{' '}
              <a href="https://bible.helloao.org/" target="_blank" rel="noreferrer">
                Free Use Bible API
              </a>{' '}
              and{' '}
              <a href="https://api.biblesupersearch.com/" target="_blank" rel="noreferrer">
                Bible SuperSearch
              </a>{' '}
              (Afrikaans 1953) when online, or import USFM / Zefania XML / Orion JSON from disk.
              {catalogSummary ? ` Catalog: ${catalogSummary}.` : ''}
            </p>
          </div>
          <button
            type="button"
            className="adw-button adw-button--flat adw-button--icon-sm"
            aria-label="Close"
            onClick={() => beginClose()}
          >
            <AppIcon name="close" size={18} />
          </button>
        </header>

        <div className="bible-library-dialog__body">
          <div className="bible-library-dialog__toolbar">
            <button
              type="button"
              className="adw-button adw-button--suggested"
              disabled={busy}
              onClick={() => void handleImport()}
            >
              Import from file…
            </button>
          </div>

          {error ? <p className="bible-library-dialog__error adw-caption">{error}</p> : null}

          <section className="bible-library-dialog__section">
            <p className="adw-section-label bible-library-dialog__section-label">
              Installed on this device
            </p>
            {bibles.length === 0 ? (
              <p className="adw-caption bible-library-dialog__empty">
                Nothing installed yet — download a translation below or import a file.
              </p>
            ) : (
              <div className="adw-list-group">
                <div className="adw-list-group__header">
                  <span>Installed</span>
                  <span className="adw-caption">{bibles.length}</span>
                </div>
                <div className="adw-list-box">
                  {bibles.map((bible) => {
                    const active = bible.id === activeId
                    return (
                      <div
                        key={bible.id}
                        className={active ? 'adw-list-row adw-list-row--current' : 'adw-list-row'}
                      >
                        <button
                          type="button"
                          className="adw-list-row__main bible-library-dialog__row-select"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => onSelect(bible.id)}
                        >
                          <span className="adw-list-row__title">{bible.label}</span>
                          <span className="adw-list-row__subtitle">
                            {bible.abbr} · {FORMAT_LABEL[bible.format]} · {bible.sourceName}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="adw-button adw-button--flat adw-button--icon-sm bible-library-dialog__row-action"
                          aria-label={`Remove ${bible.label}`}
                          disabled={busy || Boolean(downloadingId)}
                          onClick={() => setRemoveTarget({ id: bible.id, label: bible.label })}
                        >
                          <AppIcon name="trash" size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="bible-library-dialog__section bible-library-dialog__section--catalog">
            <p className="adw-section-label bible-library-dialog__section-label">Download catalog</p>
            <label className="bible-library-dialog__search">
              <span className="adw-section-label">Search translations</span>
              <input
                type="search"
                className="adw-input adw-input--compact"
                placeholder="Filter by language or name — e.g. KJV, Spanish, Afrikaans"
                value={catalogSearch}
                disabled={!catalogReady}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </label>
            {catalogReady && availableOnline.length > 0 ? (
              <p className="adw-caption bible-library-dialog__catalog-hint">
                {searchActive
                  ? `${filteredOnline.length.toLocaleString()} match(es) · grouped by language`
                  : `${availableOnline.length.toLocaleString()} available · grouped by language (English listed first)`}
              </p>
            ) : null}

            <div
              className="bible-library-dialog__catalog-panel"
              aria-busy={catalogPhase === 'loading'}
            >
              {catalogPhase === 'loading' ? (
                <div className="bible-library-dialog__catalog-status" role="status">
                  <span className="adw-spinner" aria-hidden />
                  <p className="adw-caption">Fetching Bibles…</p>
                </div>
              ) : catalogPhase === 'unavailable' ? (
                <div className="bible-library-dialog__catalog-status" role="status">
                  <p className="adw-caption bible-library-dialog__catalog-status-title">
                    Can&apos;t fetch the download list right now.
                  </p>
                  <p className="adw-caption bible-library-dialog__catalog-status-detail">
                    {!online
                      ? 'You appear to be offline. Connect to the internet or use Import from file.'
                      : catalogError
                        ? `${catalogError} You can still import translations from disk.`
                        : 'Try closing and reopening this dialog in a moment, or use Import from file.'}
                  </p>
                </div>
              ) : groupedOnline.length === 0 ? (
                <div className="bible-library-dialog__catalog-status">
                  <p className="adw-caption">
                    {searchActive
                      ? 'No matching translations (already installed or not in catalog). Try another search.'
                      : 'Nothing left to download from the catalog.'}
                  </p>
                </div>
              ) : (
                <div className="bible-library-dialog__catalog-scroll">
                  {groupedOnline.map((group) => (
                    <div key={group.language} className="adw-list-group">
                      <div className="adw-list-group__header">
                        <span>{group.language}</span>
                        <span className="adw-caption">{group.translations.length}</span>
                      </div>
                      <div className="adw-list-box">
                        {group.translations.map((t) => (
                          <div key={t.id} className="adw-list-row bible-library-dialog__catalog-row">
                            <div className="adw-list-row__main adw-list-row__main--static">
                              <span className="adw-list-row__title">{t.englishName}</span>
                              <span className="adw-list-row__subtitle">
                                {t.shortName} · {t.numberOfBooks} books
                              </span>
                              {downloadingId === t.id ? (
                                <div
                                  className="bible-library-dialog__download-progress"
                                  role="status"
                                  aria-live="polite"
                                >
                                  <span className="adw-spinner adw-spinner--sm" aria-hidden />
                                  <span className="adw-caption">Downloading…</span>
                                  <div
                                    className="adw-progress-bar adw-progress-bar--indeterminate"
                                    aria-hidden
                                  />
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="adw-button adw-button--flat bible-library-dialog__row-action"
                              disabled={Boolean(downloadingId) || !online}
                              onClick={() => void handleDownload(t.id)}
                            >
                              {downloadingId === t.id ? '…' : 'Download'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </dialog>
      <AdwAlertDialog
        open={removeTarget !== null}
        title="Remove translation?"
        body={
          <>
            <strong>{removeTarget?.label}</strong> will be deleted from this device. This cannot be
            undone. You can download or import it again later.
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Remove"
        destructive
        busy={removeBusy}
        onCancel={() => {
          if (!removeBusy) setRemoveTarget(null)
        }}
        onConfirm={() => void confirmRemove()}
      />
    </>
  )
}
