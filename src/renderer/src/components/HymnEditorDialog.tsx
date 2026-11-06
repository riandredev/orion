import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'
import {
  HYMN_EDITOR_BODY_DEFAULT,
  hymnEntryToEditorBody,
  parseHymnEditorFields,
  stanzaDisplayTag
} from '../../../shared/hymnal-stanza-format'
import type { HymnEntry, HymnalStanzaTagStyle } from '../../../shared/hymnal-types'
import { upsertHymnEntry } from '../lib/hymnals-api'
import { AppIcon } from './AppIcon'

const CLOSE_MS = 240

type HymnEditorDialogProps = {
  open: boolean
  hymnalId: string
  entry: HymnEntry | null
  tagStyle: HymnalStanzaTagStyle
  onClose: () => void
  onSaved: (entry: HymnEntry) => void
}

export function HymnEditorDialog({
  open,
  hymnalId,
  entry,
  tagStyle,
  onClose,
  onSaved
}: HymnEditorDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [number, setNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState(HYMN_EDITOR_BODY_DEFAULT)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setError(null)
      if (entry) {
        setNumber(entry.number)
        setTitle(entry.title)
        setBody(hymnEntryToEditorBody(entry))
      } else {
        setNumber(1)
        setTitle('')
        setBody(HYMN_EDITOR_BODY_DEFAULT)
      }
      return
    }
    if (mounted) {
      setVisible(false)
      const t = window.setTimeout(() => setMounted(false), CLOSE_MS)
      return () => window.clearTimeout(t)
    }
  }, [open, entry, mounted])

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

  const preview = useMemo(() => {
    try {
      return parseHymnEditorFields(number, title, body)
    } catch {
      return null
    }
  }, [number, title, body])

  if (!mounted) return null

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget && !busy) onClose()
  }

  const onSave = (): void => {
    setError(null)
    setBusy(true)
    try {
      const parsed = parseHymnEditorFields(number, title, body)
      void upsertHymnEntry(hymnalId, {
        id: entry?.id,
        number: parsed.number,
        title: parsed.title,
        stanzas: parsed.stanzas
      })
        .then((saved) => {
          onSaved(saved)
          onClose()
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Could not save hymn')
        })
        .finally(() => setBusy(false))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid hymn text')
      setBusy(false)
    }
  }

  const dialogClass = visible
    ? 'bible-library-dialog bible-library-dialog--visible'
    : 'bible-library-dialog bible-library-dialog--closing'

  const previewStanzas = preview?.stanzas ?? []

  return (
    <dialog
      ref={dialogRef}
      className={dialogClass}
      aria-labelledby="hymn-editor-title"
      onClick={onDialogClick}
    >
      <div
        className="bible-library-dialog__frame hymn-editor-dialog__frame"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="bible-library-dialog__header">
          <div>
            <h2 id="hymn-editor-title" className="bible-library-dialog__title">
              {entry ? 'Edit hymn' : 'Add hymn'}
            </h2>
            <p className="adw-caption bible-library-dialog__subtitle">
              Stanza headers: [V1], [V2], {'{Refrain}'}, {'{Chorus}'}, {'{Bridge}'} — one header per projected slide.
            </p>
          </div>
          <button
            type="button"
            className="adw-button adw-button--flat adw-button--icon-sm"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <AppIcon name="close" size={16} />
          </button>
        </header>

        <div className="bible-library-dialog__body hymn-editor-dialog__body">
          <div className="hymn-editor-dialog__fields">
            <label className="hymn-editor-dialog__field">
              <span className="adw-section-label">Number</span>
              <input
                type="number"
                min={1}
                className="adw-input"
                value={number}
                onChange={(e) => setNumber(Number(e.target.value) || 1)}
              />
            </label>
            <label className="hymn-editor-dialog__field hymn-editor-dialog__field--grow">
              <span className="adw-section-label">Title</span>
              <input
                type="text"
                className="adw-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Hymn title"
              />
            </label>
          </div>
          <label className="hymn-editor-dialog__body-field">
            <span className="adw-section-label">Lyrics</span>
            <textarea
              className="adw-input hymn-editor-dialog__textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
            />
          </label>

          {preview && previewStanzas.length > 0 ? (
            <section className="bible-library-dialog__section hymn-editor-dialog__preview-section">
              <p className="adw-section-label bible-library-dialog__section-label">
                Preview · {previewStanzas.length} stanza{previewStanzas.length === 1 ? '' : 's'}
              </p>
              <div className="adw-list-group hymn-editor-dialog__preview">
                <div className="adw-list-box">
                  {previewStanzas.map((s, i) => {
                    const line = s.lines.find((l) => l.trim()) ?? ''
                    return (
                      <div key={i} className="adw-list-row bible-library-dialog__catalog-row">
                        <div className="adw-list-row__main adw-list-row__main--static">
                          <span className="adw-list-row__title">{stanzaDisplayTag(s, tagStyle)}</span>
                          {line ? (
                            <span className="adw-list-row__subtitle">{line}</span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {error ? <p className="bible-library-dialog__error adw-caption">{error}</p> : null}
        </div>

        <footer className="hymn-editor-dialog__footer">
          <button type="button" className="adw-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="adw-button adw-button--suggested" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save hymn'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
