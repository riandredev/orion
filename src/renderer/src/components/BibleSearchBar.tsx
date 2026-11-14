import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement
} from 'react'
import {
  buildBibleSearchSuggestions,
  hitsToSuggestions,
  inferBibleSearchMode,
  parseBibleReference,
  bibleReferenceHasExplicitVerse,
  type BibleSearchScope,
  type BibleSearchSuggestion
} from '../../../shared/bible-search'
import { getBookDisplayName } from '../data/bible-books'
import { searchBibleText } from '../lib/bible-library-api'
import { AppIcon } from './AppIcon'

type BibleSearchBarProps = {
  translationId: string
  afrikaansBookNames: boolean
  passageKey: string
  scope: BibleSearchScope
  onNavigate: (target: { bookId: string; chapter: number; verse: number }) => void
  onProjectPassage: (target: { bookId: string; chapter: number; verse: number }) => void
}

const TEXT_SEARCH_DEBOUNCE_MS = 320
const AUTO_REF_DEBOUNCE_MS = 420

export function BibleSearchBar({
  translationId,
  afrikaansBookNames,
  passageKey,
  scope,
  onNavigate,
  onProjectPassage
}: BibleSearchBarProps): ReactElement {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<BibleSearchSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [textSearching, setTextSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigateFromSearchRef = useRef(false)
  const listId = 'bible-search-suggestions'

  useEffect(() => {
    if (navigateFromSearchRef.current) {
      navigateFromSearchRef.current = false
      return
    }
    setQuery('')
    setOpen(false)
  }, [passageKey])

  const effectiveMode = useMemo(() => inferBibleSearchMode(query), [query])

  const emitNavigate = useCallback(
    (target: { bookId: string; chapter: number; verse: number }) => {
      navigateFromSearchRef.current = true
      onNavigate(target)
    },
    [onNavigate]
  )

  const applySuggestion = useCallback(
    (item: BibleSearchSuggestion): void => {
      if (item.kind === 'book') {
        emitNavigate({ bookId: item.bookId, chapter: 1, verse: 1 })
        setQuery('')
        setOpen(false)
        return
      }
      if (item.kind === 'chapter' && item.chapter) {
        emitNavigate({ bookId: item.bookId, chapter: item.chapter, verse: 1 })
        setQuery('')
        setOpen(false)
        return
      }
      if (item.chapter && item.verse) {
        emitNavigate({ bookId: item.bookId, chapter: item.chapter, verse: item.verse })
        setQuery(
          `${getBookDisplayName(item.bookId, afrikaansBookNames)} ${item.chapter}:${item.verse}`
        )
        setOpen(false)
      }
    },
    [afrikaansBookNames, emitNavigate]
  )

  const applyReferenceQuery = useCallback(
    (raw: string, project = false): boolean => {
      const parsed = parseBibleReference(raw)
      if (!parsed) return false
      emitNavigate(parsed)
      if (project && bibleReferenceHasExplicitVerse(raw)) onProjectPassage(parsed)
      setQuery(
        `${getBookDisplayName(parsed.bookId, afrikaansBookNames)} ${parsed.chapter}:${parsed.verse}`
      )
      setOpen(false)
      return true
    },
    [afrikaansBookNames, emitNavigate, onProjectPassage]
  )

  const runSearch = useCallback((): void => {
    const q = query.trim()
    if (!q) return
    if (effectiveMode === 'reference' || bibleReferenceHasExplicitVerse(q)) {
      const project = bibleReferenceHasExplicitVerse(q)
      if (applyReferenceQuery(q, project)) {
        if (project) inputRef.current?.blur()
        return
      }
      if (suggestions[activeIndex]) {
        applySuggestion(suggestions[activeIndex])
        return
      }
    } else if (suggestions[activeIndex]) {
      applySuggestion(suggestions[activeIndex])
    }
  }, [activeIndex, applyReferenceQuery, applySuggestion, effectiveMode, query, suggestions])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      setOpen(false)
      setTextSearching(false)
      return
    }

    if (effectiveMode === 'reference') {
      const local = buildBibleSearchSuggestions(q, scope, afrikaansBookNames)
      setSuggestions(local)
      setOpen(true)
      setActiveIndex(0)
      setTextSearching(false)
      return
    }

    if (!translationId) {
      setSuggestions([])
      setOpen(false)
      return
    }

    setTextSearching(true)
    const bookHints = buildBibleSearchSuggestions(q, scope, afrikaansBookNames).filter(
      (s) => s.kind === 'book' || s.kind === 'chapter'
    )
    const timer = window.setTimeout(() => {
      void searchBibleText(translationId, q, effectiveMode, scope, 20)
        .then((hits) => {
          const verseSuggestions = hitsToSuggestions(hits, afrikaansBookNames)
          const merged = [...bookHints, ...verseSuggestions]
          setSuggestions(merged)
          setOpen(true)
          setActiveIndex(0)
        })
        .finally(() => setTextSearching(false))
    }, TEXT_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [afrikaansBookNames, effectiveMode, query, scope, translationId])

  useEffect(() => {
    if (effectiveMode !== 'reference') return
    const q = query.trim()
    if (!q) return
    const parsed = parseBibleReference(q)
    if (!parsed) return
    const bookOnly = !/\d/.test(q) && !q.includes(':')
    if (bookOnly) return
    const timer = window.setTimeout(() => {
      applyReferenceQuery(q)
    }, AUTO_REF_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [applyReferenceQuery, effectiveMode, query])

  function onSubmit(e: FormEvent): void {
    e.preventDefault()
    runSearch()
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        runSearch()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runSearch()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const showPanel = open && (suggestions.length > 0 || textSearching || query.trim().length > 0)

  return (
    <form className="bible-search-bar__query-wrap" role="search" onSubmit={onSubmit}>
      <div className="bible-search-bar__query">
        <AppIcon name="searchOutline" size={15} className="bible-search-bar__search-icon" />
        <input
          ref={inputRef}
          type="search"
          className="bible-search-bar__input"
          value={query}
          placeholder="Reference or text — e.g. John 3:16, mat 1, or a word"
          aria-label="Search Bible"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listId : undefined}
          aria-autocomplete="list"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          onKeyDown={onInputKeyDown}
        />
      </div>

      {showPanel ? (
        <div className="bible-search-suggestions" id={listId} role="listbox">
          {textSearching ? (
            <p className="bible-search-suggestions__status adw-caption">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="bible-search-suggestions__status adw-caption">
              {effectiveMode === 'reference'
                ? 'No matching references — try a book name or John 3:16'
                : 'No verses found in this translation'}
            </p>
          ) : (
            suggestions.map((item, index) => {
              const active = index === activeIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={
                    active
                      ? 'bible-search-suggestions__item bible-search-suggestions__item--active'
                      : 'bible-search-suggestions__item'
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => applySuggestion(item)}
                >
                  <span className="bible-search-suggestions__label">{item.label}</span>
                  {item.detail ? (
                    <span className="bible-search-suggestions__detail adw-caption">{item.detail}</span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </form>
  )
}
