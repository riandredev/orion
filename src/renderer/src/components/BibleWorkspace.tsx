import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { bibleBooks, formatPassageRefForBook, getBookById, getBookDisplayName } from '../data/bible-books'
import { isAfrikaansBibleTranslation } from '../../../shared/bible-book-names-af'
import {
  bibleTranslationSelectOptions,
  findInstalledBible,
  loadBibleTranslation,
  saveBibleTranslation,
  type BibleTranslationId
} from '../data/bible-translations'
import {
  bibleProjectionTranslationLabel,
  formatBibleProjectionLocation
} from '../../../shared/bible-projection-display'
import { fetchBibleChapter } from '../lib/bible-library-api'
import { useInstalledBibles } from '../lib/use-installed-bibles'
import { clearBibleRibbonActions, setBibleRibbonActions } from '../lib/bible-ribbon-actions'
import { setBibleActivePassage, setBibleLiveContent } from '../lib/bible-ribbon-sync'
import { sequenceFollowsKeys, useBibleSequenceCue } from '../lib/sequence-cues'
import { writeSequenceDrag } from '../lib/sequence-drag'
import { pushSequenceDraft } from '../lib/sequence-inbox'
import { currentBibleSequenceDraft, publishBibleSequenceDraft } from '../lib/sequence-sources'
import { AdwSelect } from './AdwSelect'
import { AdwTooltip } from './AdwTooltip'
import { AppIcon } from './AppIcon'
import { BibleLibraryDialog } from './BibleLibraryDialog'
import { BibleSearchBar } from './BibleSearchBar'
import type { AppIconName } from './icons'

type BibleScope = 'entire' | 'ot' | 'nt'
type BibleSearchMode = 'phrase' | 'reference' | 'word'

type HistoryEntry = {
  id: string
  ref: string
  preview: string
  bookId: string
  chapter: number
  verse: number
  text: string
  locationLabel: string
  translationLabel: string
}

const scopeOptions = [
  { value: 'entire' as const, label: 'Entire Bible' },
  { value: 'ot' as const, label: 'Old Testament' },
  { value: 'nt' as const, label: 'New Testament' }
]

const modeOptions = [
  { value: 'phrase' as const, label: 'Contains phrase' },
  { value: 'reference' as const, label: 'Reference' },
  { value: 'word' as const, label: 'Any word' }
]

const HISTORY_HEIGHT_KEY = 'orion-bible-history-height'
const DEFAULT_HISTORY_HEIGHT = 140
const MIN_HISTORY_HEIGHT = 80
const MAX_HISTORY_HEIGHT = 360

function loadHistoryHeight(): number {
  try {
    const raw = localStorage.getItem(HISTORY_HEIGHT_KEY)
    if (!raw) return DEFAULT_HISTORY_HEIGHT
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT_HISTORY_HEIGHT
    return Math.min(MAX_HISTORY_HEIGHT, Math.max(MIN_HISTORY_HEIGHT, n))
  } catch {
    return DEFAULT_HISTORY_HEIGHT
  }
}

function saveHistoryHeight(height: number): void {
  try {
    localStorage.setItem(HISTORY_HEIGHT_KEY, String(height))
  } catch {
    /* ignore */
  }
}

function RibbonIconBtn({
  label,
  icon,
  onClick
}: {
  label: string
  icon: AppIconName
  onClick?: () => void
}): ReactElement {
  return (
    <AdwTooltip text={label}>
      <button
        type="button"
        className="adw-button adw-button--flat adw-button--icon-sm bible-verse-toolbar__btn"
        aria-label={label}
        onClick={onClick}
      >
        <AppIcon name={icon} size={16} />
      </button>
    </AdwTooltip>
  )
}

export function BibleWorkspace({
  onProjectToOutputs
}: {
  onProjectToOutputs: () => void
}): ReactElement {
  const [bookId, setBookId] = useState('gen')
  const [chapter, setChapter] = useState(1)
  const [verse, setVerse] = useState(1)
  const [scope, setScope] = useState<BibleScope>('entire')
  const [mode, setMode] = useState<BibleSearchMode>('phrase')
  const { bibles, importNew, downloadCatalog, remove } = useInstalledBibles()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [translation, setTranslation] = useState<BibleTranslationId>(() =>
    loadBibleTranslation('eng-kjv')
  )
  const [verses, setVerses] = useState<{ number: number; text: string }[]>([])
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState<string | null>(null)
  const [autoSearch, setAutoSearch] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyHeight, setHistoryHeight] = useState(loadHistoryHeight)
  const [historyResize, setHistoryResize] = useState<{
    pointerId: number
    startY: number
    startHeight: number
  } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const book = getBookById(bookId) ?? bibleBooks[0]
  const filteredBooks = useMemo(() => {
    if (scope === 'ot') return bibleBooks.filter((b) => b.testament === 'ot')
    if (scope === 'nt') return bibleBooks.filter((b) => b.testament === 'nt')
    return bibleBooks
  }, [scope])

  const chapters = useMemo(
    () => Array.from({ length: book.chapters }, (_, i) => i + 1),
    [book.chapters]
  )

  useEffect(() => {
    const onProfile = (): void => setTranslation(loadBibleTranslation(translation))
    window.addEventListener('orion-profile-applied', onProfile)
    return () => window.removeEventListener('orion-profile-applied', onProfile)
  }, [translation])

  useEffect(() => {
    const sync = (): void => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  const translationOptions = useMemo(() => bibleTranslationSelectOptions(bibles), [bibles])
  const translationMeta = findInstalledBible(bibles, translation)
  const afrikaansBooks = isAfrikaansBibleTranslation(translationMeta)
  const passageRef = formatPassageRefForBook(bookId, chapter, verse, afrikaansBooks)
  const translationLabel = bibleProjectionTranslationLabel(translationMeta, translation)
  const locationLabel = useMemo(
    () =>
      formatBibleProjectionLocation(
        getBookDisplayName(bookId, afrikaansBooks),
        chapter,
        verse
      ),
    [bookId, chapter, verse, afrikaansBooks]
  )

  useEffect(() => {
    if (bibles.length === 0) {
      if (translation) setTranslation('')
      return
    }
    if (bibles.some((b) => b.id === translation)) return
    const saved = loadBibleTranslation('')
    const next = bibles.find((b) => b.id === saved)?.id ?? bibles[0]!.id
    setTranslation(next)
    saveBibleTranslation(next)
  }, [bibles, translation])

  useEffect(() => {
    if (!translation) {
      setVerses([])
      return
    }
    let cancelled = false
    setChapterLoading(true)
    setChapterError(null)
    void fetchBibleChapter(translation, book.id, chapter)
      .then((result) => {
        if (cancelled) return
        setVerses(result.verses)
      })
      .catch(() => {
        if (cancelled) return
        setChapterError('Could not load this chapter.')
        setVerses([])
      })
      .finally(() => {
        if (!cancelled) setChapterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [translation, book.id, chapter])

  useEffect(() => {
    if (verses.length === 0) return
    if (!verses.some((v) => v.number === verse)) {
      setVerse(verses[0]!.number)
    }
  }, [verses, verse])

  useEffect(() => {
    setBibleActivePassage(passageRef)
  }, [passageRef])

  useEffect(
    () => () => {
      setBibleActivePassage('Select a passage')
    },
    []
  )

  useEffect(() => {
    const selected = verses.find((line) => line.number === verse)
    if (!selected) {
      if (verses.length === 0) return
      publishBibleSequenceDraft(null)
      setBibleLiveContent(null)
      return
    }
    const draft = {
      kind: 'bible' as const,
      bookId,
      chapter,
      verse,
      text: selected.text,
      reference: passageRef,
      locationLabel,
      translationLabel
    }
    publishBibleSequenceDraft(draft)
    setBibleLiveContent({
      reference: passageRef,
      locationLabel,
      translationLabel,
      highlightVerse: verse,
      bookId,
      verses: [{ number: selected.number, text: selected.text }]
    })
  }, [passageRef, locationLabel, translationLabel, verse, verses, bookId, chapter])

  function onTranslationChange(id: BibleTranslationId): void {
    setTranslation(id)
    saveBibleTranslation(id)
  }

  function selectBook(id: string): void {
    const next = getBookById(id)
    if (!next) return
    setBookId(id)
    setChapter(1)
    setVerse(1)
  }

  function selectChapter(n: number): void {
    setChapter(n)
    setVerse(1)
  }

  function selectVerse(n: number, text: string): void {
    setVerse(n)
    const ref = formatPassageRefForBook(bookId, chapter, n, afrikaansBooks)
    const locationLabel = formatBibleProjectionLocation(
      getBookDisplayName(bookId, afrikaansBooks),
      chapter,
      n
    )
    setBibleActivePassage(ref)
    setBibleLiveContent({
      reference: ref,
      locationLabel,
      translationLabel,
      highlightVerse: n,
      bookId,
      verses: [{ number: n, text }]
    })
    const preview = text.length > 72 ? `${text.slice(0, 72)}…` : text
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.ref !== ref)
      return [
        {
          id: `${Date.now()}`,
          ref,
          preview,
          bookId,
          chapter,
          verse: n,
          text,
          locationLabel,
          translationLabel
        },
        ...filtered
      ].slice(0, 12)
    })
  }

  function openHistoryEntry(entry: HistoryEntry): void {
    setBookId(entry.bookId)
    setChapter(entry.chapter)
    setVerse(entry.verse)
    setBibleActivePassage(entry.ref)
    setBibleLiveContent({
      reference: entry.ref,
      locationLabel: entry.locationLabel,
      translationLabel: entry.translationLabel,
      highlightVerse: entry.verse,
      bookId: entry.bookId,
      verses: [{ number: entry.verse, text: entry.text }]
    })
    onProjectToOutputs()
  }

  function navigateToPassage(target: { bookId: string; chapter: number; verse: number }): void {
    setBookId(target.bookId)
    setChapter(target.chapter)
    setVerse(target.verse)
  }

  const bibleCue = useBibleSequenceCue()
  const navigateRef = useRef(navigateToPassage)
  navigateRef.current = navigateToPassage
  useEffect(() => {
    if (!bibleCue?.bookId) return
    navigateRef.current({ bookId: bibleCue.bookId, chapter: bibleCue.chapter, verse: bibleCue.verse })
  }, [bibleCue])

  function clearHistory(): void {
    setHistory([])
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (document.querySelector('.bible-workspace')?.closest('.tab-keep--hidden')) return
      if (sequenceFollowsKeys()) return
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'
      ) {
        return
      }

      const bookIndex = filteredBooks.findIndex((b) => b.id === bookId)
      const verseIndex = verses.findIndex((v) => v.number === verse)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (bookIndex < filteredBooks.length - 1) {
          selectBook(filteredBooks[bookIndex + 1].id)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (bookIndex > 0) {
          selectBook(filteredBooks[bookIndex - 1].id)
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (verseIndex >= 0 && verseIndex < verses.length - 1) {
          const next = verses[verseIndex + 1]
          selectVerse(next.number, next.text)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (verseIndex > 0) {
          const prev = verses[verseIndex - 1]
          selectVerse(prev.number, prev.text)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onProjectToOutputs()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bookId, filteredBooks, verse, verses, book.name, chapter, onProjectToOutputs])

  const navRef = useRef({
    prevVerse: () => {},
    nextVerse: () => {},
    prevBook: () => {},
    nextBook: () => {}
  })
  navRef.current = {
    prevVerse: () => {
      const verseIndex = verses.findIndex((v) => v.number === verse)
      if (verseIndex <= 0) return
      const prev = verses[verseIndex - 1]
      selectVerse(prev.number, prev.text)
    },
    nextVerse: () => {
      const verseIndex = verses.findIndex((v) => v.number === verse)
      if (verseIndex < 0 || verseIndex >= verses.length - 1) return
      const next = verses[verseIndex + 1]
      selectVerse(next.number, next.text)
    },
    prevBook: () => {
      const bookIndex = filteredBooks.findIndex((b) => b.id === bookId)
      if (bookIndex <= 0) return
      selectBook(filteredBooks[bookIndex - 1].id)
    },
    nextBook: () => {
      const bookIndex = filteredBooks.findIndex((b) => b.id === bookId)
      if (bookIndex < 0 || bookIndex >= filteredBooks.length - 1) return
      selectBook(filteredBooks[bookIndex + 1].id)
    }
  }

  useEffect(() => {
    setBibleRibbonActions({
      prevVerse: () => navRef.current.prevVerse(),
      nextVerse: () => navRef.current.nextVerse(),
      prevBook: () => navRef.current.prevBook(),
      nextBook: () => navRef.current.nextBook()
    })
    return () => clearBibleRibbonActions()
  }, [])

  useEffect(() => {
    if (!historyResize) return
    const pointerId = historyResize.pointerId
    const startY = historyResize.startY
    const startHeight = historyResize.startHeight

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      const next = Math.min(
        MAX_HISTORY_HEIGHT,
        Math.max(MIN_HISTORY_HEIGHT, startHeight + (startY - e.clientY))
      )
      setHistoryHeight(next)
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      setHistoryHeight((h) => {
        saveHistoryHeight(h)
        return h
      })
      setHistoryResize(null)
    }

    document.body.classList.add('orion-bible-history-resize')
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      document.body.classList.remove('orion-bible-history-resize')
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [historyResize])

  function startHistoryResize(e: ReactPointerEvent<HTMLDivElement>): void {
    if (e.button !== 0 || !historyOpen) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setHistoryResize({
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: historyHeight
    })
  }

  return (
    <div className="bible-workspace">
      <div className="bible-search-bar">
        <div className="bible-search-bar__row">
          <BibleSearchBar
            translationId={translation}
            afrikaansBookNames={afrikaansBooks}
            passageKey={`${bookId}:${chapter}:${verse}`}
            scope={scope}
            mode={mode}
            autoSearch={autoSearch}
            onAutoSearchChange={setAutoSearch}
            onNavigate={navigateToPassage}
          />
          <div className="bible-search-bar__translation-group">
            <label className="order-ribbon__field order-ribbon__field--select bible-search-bar__translation">
              <span className="adw-section-label">Translation</span>
              <AdwSelect
                value={translation || translationOptions[0]?.value || ''}
                options={
                  translationOptions.length > 0
                    ? translationOptions
                    : [{ value: '', label: 'None' }]
                }
                disabled={translationOptions.length === 0}
                aria-label={
                  translationMeta
                    ? `Bible translation: ${translationMeta.label}`
                    : 'Bible translation'
                }
                onChange={onTranslationChange}
              />
            </label>
            <button
              type="button"
              className="adw-button adw-button--flat bible-search-bar__translations-btn"
              aria-label="Manage and import Bible translations"
              onClick={() => setLibraryOpen(true)}
            >
              Translations…
            </button>
          </div>
          <label className="order-ribbon__field order-ribbon__field--select">
            <span className="adw-section-label">Scope</span>
            <AdwSelect
              value={scope}
              options={scopeOptions}
              aria-label="Search scope"
              onChange={setScope}
            />
          </label>
          <label className="order-ribbon__field order-ribbon__field--select">
            <span className="adw-section-label">Mode</span>
            <AdwSelect
              value={mode}
              options={modeOptions}
              aria-label="Search mode"
              onChange={setMode}
            />
          </label>
        </div>
      </div>

      <div className="bible-browser">
        <nav className="bible-panel bible-panel--books" aria-label="Books">
          <ul className="bible-panel__list">
            {filteredBooks.map((b) => {
              const selected = b.id === bookId
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className={selected ? 'bible-panel__item bible-panel__item--selected' : 'bible-panel__item'}
                    onClick={() => selectBook(b.id)}
                  >
                    {getBookDisplayName(b.id, afrikaansBooks)}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <nav className="bible-panel bible-panel--chapters" aria-label="Chapters">
          <ul className="bible-panel__list bible-panel__list--grid">
            {chapters.map((n) => {
              const selected = n === chapter
              return (
                <li key={n}>
                  <button
                    type="button"
                    className={
                      selected
                        ? 'bible-panel__item bible-panel__item--chapter bible-panel__item--selected'
                        : 'bible-panel__item bible-panel__item--chapter'
                    }
                    onClick={() => selectChapter(n)}
                  >
                    {n}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section className="bible-panel bible-panel--verses" aria-label="Passage">
          <header className="bible-verse-toolbar">
            <div className="bible-verse-toolbar__heading">
              <span className="bible-verse-toolbar__ref adw-title-2">{passageRef.split(':')[0]}</span>
              {translationMeta ? (
                <span className="bible-verse-toolbar__translation adw-caption">{translationMeta.abbr}</span>
              ) : null}
            </div>
            <div className="bible-verse-toolbar__actions">
              <RibbonIconBtn label="Cross references" icon="passageRef" />
              <span className="bible-verse-toolbar__hint adw-caption">Ctrl Shift</span>
              <RibbonIconBtn
                label="Add to sequence"
                icon="listPlus"
                onClick={() => {
                  const draft = currentBibleSequenceDraft()
                  if (draft) pushSequenceDraft(draft)
                }}
              />
              <RibbonIconBtn
                label="Send to outputs"
                icon="expand"
                onClick={onProjectToOutputs}
              />
            </div>
          </header>
          <ol className="bible-verse-list">
            {chapterLoading ? (
              <li className="bible-verse-list__status adw-caption">Loading chapter…</li>
            ) : chapterError ? (
              <li className="bible-verse-list__status adw-caption">{chapterError}</li>
            ) : verses.length === 0 ? (
              <li className="bible-verse-list__status adw-caption">
                {translation
                  ? 'This chapter is not available in the selected translation.'
                  : 'Import a Bible translation to read Scripture here.'}
              </li>
            ) : (
              verses.map((line) => {
                const selected = line.number === verse
                return (
                  <li key={line.number}>
                    <button
                      type="button"
                      className={
                        selected ? 'bible-verse bible-verse--selected' : 'bible-verse'
                      }
                      draggable
                      onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                        writeSequenceDrag(event.dataTransfer, {
                          op: 'insert',
                          draft: {
                            kind: 'bible',
                            bookId,
                            chapter,
                            verse: line.number,
                            text: line.text,
                            reference: formatPassageRefForBook(bookId, chapter, line.number, afrikaansBooks),
                            locationLabel: formatBibleProjectionLocation(
                              getBookDisplayName(bookId, afrikaansBooks),
                              chapter,
                              line.number
                            ),
                            translationLabel
                          }
                        })
                      }}
                      onClick={() => selectVerse(line.number, line.text)}
                      onDoubleClick={() => {
                        selectVerse(line.number, line.text)
                        onProjectToOutputs()
                      }}
                    >
                      <span className="bible-verse__num">{line.number}</span>
                      <span className="bible-verse__text">{line.text}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ol>
        </section>
      </div>

      <section
        className={historyOpen ? 'bible-history' : 'bible-history bible-history--collapsed'}
        style={historyOpen ? { height: historyHeight } : undefined}
      >
        {historyOpen ? (
          <div className="bible-history__resize-wrap">
            <div
              className="bible-history__resize"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize history panel"
              onPointerDown={startHistoryResize}
            />
          </div>
        ) : null}
        <header className="bible-history__header">
          <button
            type="button"
            className="bible-history__toggle"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
          >
            <AppIcon name={historyOpen ? 'caretDown' : 'caretRight'} size={14} />
            History
          </button>
          <AdwTooltip text="Clear history">
            <button
              type="button"
              className="adw-button adw-button--flat adw-button--icon-sm"
              aria-label="Clear history"
              onClick={clearHistory}
            >
              <AppIcon name="trash" size={16} />
            </button>
          </AdwTooltip>
        </header>
        {historyOpen ? (
          <ul className="bible-history__list">
            {history.length === 0 ? (
              <li className="bible-history__empty adw-caption">No passages yet</li>
            ) : (
              history.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="bible-history__item"
                    onClick={() => openHistoryEntry(entry)}
                  >
                    <span className="bible-history__ref">{entry.ref}</span>
                    <span className="bible-history__preview adw-caption">{entry.preview}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>

      <BibleLibraryDialog
        open={libraryOpen}
        bibles={bibles}
        activeId={translation}
        online={online}
        onClose={() => setLibraryOpen(false)}
        onImport={importNew}
        onDownload={downloadCatalog}
        onRemove={remove}
        onSelect={(id) => {
          setTranslation(id)
          saveBibleTranslation(id)
          setLibraryOpen(false)
        }}
      />
    </div>
  )
}
