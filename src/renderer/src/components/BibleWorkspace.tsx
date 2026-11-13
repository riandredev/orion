import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
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
import { bibleCrossRefs, loadBibleCrossRefs } from '../lib/bible-cross-refs'
import type { BibleCrossRef } from '../../../shared/bible-cross-refs'
import { fetchBibleChapter } from '../lib/bible-library-api'
import { useInstalledBibles } from '../lib/use-installed-bibles'
import { clearBibleRibbonActions, setBibleRibbonActions } from '../lib/bible-ribbon-actions'
import { setBibleActivePassage, setBibleLiveContent } from '../lib/bible-ribbon-sync'
import { sequenceFollowsKeys, useBibleSequenceCue } from '../lib/sequence-cues'
import { touchProfileSettings } from '../lib/profile-autosave'
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
const CROSS_REF_KEY = 'orion-bible-cross-refs'
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
  touchProfileSettings()
}

function loadShowCrossRefs(): boolean {
  try {
    return localStorage.getItem(CROSS_REF_KEY) !== '0'
  } catch {
    return true
  }
}

function crossRefLabel(ref: BibleCrossRef, afrikaans: boolean): string {
  const label = formatPassageRefForBook(ref.bookId, ref.chapter, ref.verse, afrikaans)
  return ref.endVerse && ref.endVerse !== ref.verse ? `${label}\u2013${ref.endVerse}` : label
}

function RibbonIconBtn({
  label,
  icon,
  onClick,
  pressed
}: {
  label: string
  icon: AppIconName
  onClick?: () => void
  pressed?: boolean
}): ReactElement {
  return (
    <AdwTooltip text={label}>
      <button
        type="button"
        className={
          pressed
            ? 'adw-button adw-button--flat adw-button--icon-sm bible-verse-toolbar__btn bible-verse-toolbar__btn--on'
            : 'adw-button adw-button--flat adw-button--icon-sm bible-verse-toolbar__btn'
        }
        aria-label={label}
        aria-pressed={pressed}
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
  const [showCrossRefs, setShowCrossRefs] = useState(loadShowCrossRefs)
  const [crossRefsReady, setCrossRefsReady] = useState(false)
  const [xrefMenu, setXrefMenu] = useState<{
    verse: number
    left: number
    top: number
    above: boolean
  } | null>(null)

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
    const onProfile = (): void => {
      setTranslation(loadBibleTranslation(translation))
      setHistoryHeight(loadHistoryHeight())
      setShowCrossRefs(loadShowCrossRefs())
    }
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

  const chapterLoad = useRef(0)
  const versesFromLoad = useRef(0)
  const navHold = useRef<{ bookId: string; chapter: number; verse: number } | null>(null)
  const projectPending = useRef<{ bookId: string; chapter: number; verse: number } | null>(null)
  const projectRef = useRef(onProjectToOutputs)
  projectRef.current = onProjectToOutputs

  useEffect(() => {
    if (!showCrossRefs) return
    let cancelled = false
    void loadBibleCrossRefs()
      .then(() => {
        if (!cancelled) setCrossRefsReady(true)
      })
      .catch(() => {
        if (!cancelled) setCrossRefsReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [showCrossRefs])

  useEffect(() => {
    if (!xrefMenu) return
    const close = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.bible-xref-menu') || target.closest('.bible-verse__refs')) return
      setXrefMenu(null)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setXrefMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [xrefMenu])

  useEffect(() => {
    if (!translation) {
      setVerses([])
      return
    }
    const loadId = ++chapterLoad.current
    let cancelled = false
    setChapterLoading(true)
    setChapterError(null)
    void fetchBibleChapter(translation, book.id, chapter)
      .then((result) => {
        if (cancelled || loadId !== chapterLoad.current) return
        versesFromLoad.current = loadId
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
    if (versesFromLoad.current !== chapterLoad.current) return
    const hold = navHold.current
    if (hold && hold.bookId === bookId && hold.chapter === chapter) {
      navHold.current = null
      if (verses.some((v) => v.number === hold.verse)) {
        if (verse !== hold.verse) setVerse(hold.verse)
        return
      }
    }
    if (verses.length === 0) return
    if (!verses.some((v) => v.number === verse)) {
      setVerse(verses[0]!.number)
    }
  }, [verses, verse, bookId, chapter])

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
    const pending = projectPending.current
    if (
      pending &&
      versesFromLoad.current === chapterLoad.current &&
      pending.bookId === bookId &&
      pending.chapter === chapter &&
      pending.verse === selected.number
    ) {
      projectPending.current = null
      projectRef.current()
    }
  }, [passageRef, locationLabel, translationLabel, verse, verses, bookId, chapter])

  function onTranslationChange(id: BibleTranslationId): void {
    setTranslation(id)
    saveBibleTranslation(id)
  }

  function selectBook(id: string): void {
    const next = getBookById(id)
    if (!next) return
    navHold.current = null
    setXrefMenu(null)
    setBookId(id)
    setChapter(1)
    setVerse(1)
  }

  function selectChapter(n: number): void {
    navHold.current = null
    setXrefMenu(null)
    setChapter(n)
    setVerse(1)
  }

  function selectVerse(n: number, text: string): void {
    navHold.current = null
    setXrefMenu(null)
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
    navHold.current = target
    setXrefMenu(null)
    setBookId(target.bookId)
    setChapter(target.chapter)
    setVerse(target.verse)
  }

  function projectSearchedPassage(target: { bookId: string; chapter: number; verse: number }): void {
    const alreadyShowing =
      target.bookId === bookId &&
      target.chapter === chapter &&
      target.verse === verse &&
      versesFromLoad.current === chapterLoad.current &&
      verses.some((line) => line.number === target.verse)
    if (alreadyShowing) {
      projectPending.current = null
      onProjectToOutputs()
      return
    }
    projectPending.current = target
  }

  function toggleCrossRefs(): void {
    setShowCrossRefs((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CROSS_REF_KEY, next ? '1' : '0')
      } catch {
        /* the choice still applies for this session */
      }
      touchProfileSettings()
      return next
    })
    setXrefMenu(null)
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
      } else if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key === 'Shift' && !e.repeat) {
        e.preventDefault()
        toggleCrossRefs()
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
            onProjectPassage={projectSearchedPassage}
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
              <RibbonIconBtn
                label="Cross references"
                icon="passageRef"
                pressed={showCrossRefs}
                onClick={toggleCrossRefs}
              />
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
          <ol
            className="bible-verse-list"
            onScroll={() => {
              if (xrefMenu) setXrefMenu(null)
            }}
          >
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
                const refs =
                  showCrossRefs && crossRefsReady ? bibleCrossRefs(bookId, chapter, line.number) : []
                return (
                  <li
                    key={line.number}
                    className={
                      selected ? 'bible-verse-row bible-verse-row--selected' : 'bible-verse-row'
                    }
                  >
                    <button
                      type="button"
                      className="bible-verse"
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
                    {refs.length > 0 ? (
                      <button
                        type="button"
                        className="bible-verse__refs"
                        aria-label={`${refs.length} cross references`}
                        aria-expanded={xrefMenu?.verse === line.number}
                        onClick={(event) => {
                          event.stopPropagation()
                          selectVerse(line.number, line.text)
                          const rect = event.currentTarget.getBoundingClientRect()
                          const above = rect.bottom + 288 > window.innerHeight && rect.top > 160
                          setXrefMenu({
                            verse: line.number,
                            left: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 236)),
                            top: above ? rect.top - 4 : rect.bottom + 4,
                            above
                          })
                        }}
                      >
                        {refs.length}
                      </button>
                    ) : null}
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
      {xrefMenu && showCrossRefs
        ? createPortal(
            <div
              className="bible-xref-menu"
              role="menu"
              style={
                xrefMenu.above
                  ? { left: xrefMenu.left, bottom: window.innerHeight - xrefMenu.top }
                  : { left: xrefMenu.left, top: xrefMenu.top }
              }
            >
              {bibleCrossRefs(bookId, chapter, xrefMenu.verse).map((ref) => {
                const label = crossRefLabel(ref, afrikaansBooks)
                return (
                  <button
                    key={`${ref.bookId}-${ref.chapter}-${ref.verse}-${ref.endVerse ?? ''}`}
                    type="button"
                    role="menuitem"
                    className="bible-xref-menu__item"
                    onClick={() => navigateToPassage({ bookId: ref.bookId, chapter: ref.chapter, verse: ref.verse })}
                  >
                    {label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
