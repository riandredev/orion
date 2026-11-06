import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactElement, type SetStateAction } from 'react'
import { bibleBooks } from '../data/bible-books'
import {
  bibleTranslationSelectOptions,
  loadBibleTranslation,
  saveBibleTranslation,
  type BibleTranslationId
} from '../data/bible-translations'
import { getDictionaryLiveContent, setDictionaryActiveEntry, setDictionaryLiveContent } from '../lib/dictionary-ribbon-sync'
import { writeSequenceDrag } from '../lib/sequence-drag'
import {
  getDictionaryWorkspaceSession,
  patchDictionaryWorkspaceSession
} from '../lib/dictionary-workspace-session'
import { useInstalledBibles } from '../lib/use-installed-bibles'
import {
  ensureDictionaryReady,
  getDictionaryIndexProgress,
  getDictionaryLexiconEntry,
  getDictionaryScriptureOccurrences,
  searchDictionaryEntries
} from '../lib/dictionary-api'
import { formatStrongsDisplay, primarySenseLabel, buildDictionaryProjectionInfoBar } from '../../../shared/dictionary-lexicon'
import type { LexiconLanguageFilter } from '../../../shared/dictionary-lexicon'
import type {
  DictionaryIndexProgress,
  LexiconEntry,
  LexiconEntrySummary
} from '../../../shared/dictionary-types'
import { AdwSelect } from './AdwSelect'
import { AppIcon } from './AppIcon'

const languageFilters: { id: LexiconLanguageFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hebrew', label: 'Hebrew' },
  { id: 'greek', label: 'Greek' }
]

const LIST_PAGE_SIZE = 120

function readDictionarySession() {
  return getDictionaryWorkspaceSession()
}

export function DictionaryWorkspace(): ReactElement {
  const sessionSeed = readDictionarySession()
  const { bibles } = useInstalledBibles()
  const translationOptions = useMemo(() => bibleTranslationSelectOptions(bibles), [bibles])
  const [translation, setTranslation] = useState<BibleTranslationId>(() => loadBibleTranslation())
  const [language, setLanguage] = useState<LexiconLanguageFilter>(() => sessionSeed.language)
  const [query, setQuery] = useState(() => sessionSeed.query)
  const [indexReady, setIndexReady] = useState(false)
  const [progress, setProgress] = useState<DictionaryIndexProgress>({
    phase: 'idle',
    completedChapters: 0,
    totalChapters: 0
  })
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (sessionSeed.selectedId) return sessionSeed.selectedId
    const live = getDictionaryLiveContent()
    if (live?.strongs) return live.strongs
    return 'H0001'
  })
  const setSelectedId = useCallback((value: SetStateAction<string | null>) => {
    setSelectedIdState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      patchDictionaryWorkspaceSession({ selectedId: next })
      return next
    })
  }, [])
  const [entry, setEntry] = useState<LexiconEntry | null>(null)
  const [entryLoading, setEntryLoading] = useState(false)
  const [scriptureBook, setScriptureBookState] = useState<string>(() => sessionSeed.scriptureBook)
  const [scriptureChapter, setScriptureChapterState] = useState<string>(() => sessionSeed.scriptureChapter)
  const setScriptureBook = useCallback((value: string) => {
    setScriptureBookState(value)
    patchDictionaryWorkspaceSession({ scriptureBook: value })
  }, [])
  const setScriptureChapter = useCallback((value: string) => {
    setScriptureChapterState(value)
    patchDictionaryWorkspaceSession({ scriptureChapter: value })
  }, [])
  const [occurrenceOffset, setOccurrenceOffset] = useState(0)
  const [occurrenceTotal, setOccurrenceTotal] = useState(0)
  const [occurrences, setOccurrences] = useState<
    import('../../../shared/dictionary-types').DictionaryScriptureOccurrence[]
  >([])
  const [scriptureLoading, setScriptureLoading] = useState(false)
  const scriptureRequestRef = useRef(0)

  const [listEntries, setListEntries] = useState<LexiconEntrySummary[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const listScrollRef = useRef<HTMLUListElement>(null)
  const listFilterKeyRef = useRef<string | null>(`${sessionSeed.query}\0${sessionSeed.language}`)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  useEffect(() => {
    patchDictionaryWorkspaceSession({ query })
  }, [query])

  useEffect(() => {
    patchDictionaryWorkspaceSession({ language })
  }, [language])

  useEffect(() => {
    return () => {
      patchDictionaryWorkspaceSession({ listScrollTop: listScrollRef.current?.scrollTop ?? 0 })
    }
  }, [])

  useEffect(() => {
    if (!indexReady) {
      setListEntries([])
      setListTotal(0)
      return
    }
    let cancelled = false
    setListLoading(true)
    void searchDictionaryEntries(query, language, 0, LIST_PAGE_SIZE).then(({ total, items }) => {
      if (cancelled) return
      setListTotal(total)
      setListEntries(items)
      setListLoading(false)
      const q = query.trim()
      setSelectedId((prev) => {
        if (items.length === 0) return q ? null : prev
        if (prev && items.some((e) => e.id === prev)) return prev
        if (q) return items[0]?.id ?? null
        if (prev) return prev
        return items[0]?.id ?? null
      })

      const filterKey = `${query}\0${language}`
      const filterChanged = listFilterKeyRef.current !== filterKey
      listFilterKeyRef.current = filterKey
      if (filterChanged) {
        if (listScrollRef.current) listScrollRef.current.scrollTop = 0
        patchDictionaryWorkspaceSession({ listScrollTop: 0 })
      } else {
        const top = getDictionaryWorkspaceSession().listScrollTop
        requestAnimationFrame(() => {
          if (listScrollRef.current) listScrollRef.current.scrollTop = top
        })
      }

      const sid = selectedIdRef.current
      if (sid && !items.some((e) => e.id === sid)) {
        void searchDictionaryEntries(formatStrongsDisplay(sid), language, 0, 8).then(({ items: hits }) => {
          if (cancelled) return
          const hit = hits.find((h) => h.id === sid) ?? hits[0]
          if (!hit) return
          setListEntries((prev) => {
            if (prev.some((e) => e.id === hit.id)) return prev
            return [hit, ...prev]
          })
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [indexReady, query, language])

  const loadMoreListEntries = useCallback(() => {
    if (listLoading || listLoadingMore || listEntries.length >= listTotal) return
    setListLoadingMore(true)
    void searchDictionaryEntries(query, language, listEntries.length, LIST_PAGE_SIZE)
      .then(({ items }) => {
        if (items.length === 0) return
        setListEntries((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          const merged = [...prev]
          for (const item of items) {
            if (!seen.has(item.id)) merged.push(item)
          }
          return merged
        })
      })
      .finally(() => setListLoadingMore(false))
  }, [query, language, listEntries.length, listTotal, listLoading, listLoadingMore])

  const onListScroll = useCallback(() => {
    const el = listScrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 96) {
      loadMoreListEntries()
    }
  }, [loadMoreListEntries])

  const bookOptions = useMemo(
    () => [{ value: 'all', label: 'All books' }, ...bibleBooks.map((b) => ({ value: b.id, label: b.name }))],
    []
  )

  const chapterOptions = useMemo(() => {
    if (scriptureBook === 'all') return [{ value: 'all', label: 'All' }]
    const book = bibleBooks.find((b) => b.id === scriptureBook)
    if (!book) return [{ value: 'all', label: 'All' }]
    return [
      { value: 'all', label: 'All' },
      ...Array.from({ length: book.chapters }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1)
      }))
    ]
  }, [scriptureBook])

  useEffect(() => {
    let cancelled = false
    const pollId = window.setInterval(() => {
      void getDictionaryIndexProgress().then((p) => {
        if (!cancelled) setProgress(p)
      })
    }, 800)
    void ensureDictionaryReady()
      .then(({ progress: p }) => {
        if (cancelled) return
        setIndexReady(true)
        setProgress(p)
      })
      .catch(() => {
        if (cancelled) return
        setIndexReady(true)
        void getDictionaryIndexProgress().then(setProgress)
      })
    return () => {
      cancelled = true
      window.clearInterval(pollId)
    }
  }, [])

  useEffect(() => {
    if (progress.phase !== 'building' && progress.lexiconSearchPhase !== 'building') return
    const id = window.setInterval(() => {
      void getDictionaryIndexProgress().then(setProgress)
    }, 800)
    return () => window.clearInterval(id)
  }, [progress.phase, progress.lexiconSearchPhase])

  useEffect(() => {
    if (!selectedId) {
      setEntry(null)
      setDictionaryLiveContent(null)
      return
    }
    let cancelled = false
    setEntryLoading(true)
    setDictionaryLiveContent(null)
    void getDictionaryLexiconEntry(selectedId).then((e) => {
      if (cancelled) return
      setEntry(e)
      setEntryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  useEffect(() => {
    if (!entry) {
      setDictionaryActiveEntry('Select a lexicon entry')
      setDictionaryLiveContent(null)
      return
    }
    const sense = entry.senses[0]
    const label = sense
      ? `${formatStrongsDisplay(entry.id)} · ${sense.lemma}${sense.transliteration ? ` (${sense.transliteration})` : ''}`
      : formatStrongsDisplay(entry.id)
    setDictionaryActiveEntry(label)
    if (!sense) {
      setDictionaryLiveContent(null)
      return
    }
    const { segments, activeIndex } = buildDictionaryProjectionInfoBar(
      entry.language,
      entry.senses.map((s) => ({
        partOfSpeech: s.partOfSpeech,
        transliteration: s.transliteration,
        gloss: s.gloss,
        definition: s.definition
      }))
    )
    const projectedSense = entry.senses[activeIndex] ?? sense
    setDictionaryLiveContent({
      strongs: entry.id,
      lemma: projectedSense.lemma,
      transliteration: projectedSense.transliteration,
      gloss: projectedSense.gloss,
      partOfSpeech: projectedSense.partOfSpeech,
      definition: projectedSense.definition,
      language: entry.language,
      infoBar: segments,
      infoBarActive: activeIndex
    })
  }, [entry])

  const loadOccurrences = useCallback(
    async (offset: number, requestId: number) => {
      if (!selectedId || progress.phase !== 'ready') {
        if (scriptureRequestRef.current === requestId) {
          setOccurrences([])
          setOccurrenceTotal(0)
        }
        return
      }
      const bookId = scriptureBook === 'all' ? null : scriptureBook
      const chapter =
        scriptureChapter === 'all' || bookId == null ? null : Number(scriptureChapter)
      const { total, items } = await getDictionaryScriptureOccurrences(selectedId, {
        bibleId: translation || undefined,
        bookId,
        chapter: Number.isFinite(chapter) ? chapter : null,
        offset,
        limit: 8
      })
      if (scriptureRequestRef.current !== requestId) return
      setOccurrenceTotal(total)
      setOccurrences(items)
      setOccurrenceOffset(offset)
    },
    [selectedId, progress.phase, scriptureBook, scriptureChapter, translation]
  )

  useEffect(() => {
    if (!selectedId || progress.phase !== 'ready') {
      setOccurrences([])
      setOccurrenceTotal(0)
      setScriptureLoading(false)
      return
    }
    const requestId = ++scriptureRequestRef.current
    setScriptureLoading(true)
    setOccurrences([])
    setOccurrenceTotal(0)
    setOccurrenceOffset(0)
    void loadOccurrences(0, requestId).finally(() => {
      if (scriptureRequestRef.current === requestId) {
        setScriptureLoading(false)
      }
    })
  }, [selectedId, progress.phase, scriptureBook, scriptureChapter, translation, loadOccurrences])

  const primarySense = entry?.senses[0]
  const progressPct =
    progress.totalChapters > 0
      ? Math.round((progress.completedChapters / progress.totalChapters) * 100)
      : 0
  const lexiconSearchPct =
    progress.lexiconSearchTotal && progress.lexiconSearchTotal > 0
      ? Math.round(((progress.lexiconSearchCompleted ?? 0) / progress.lexiconSearchTotal) * 100)
      : 0

  return (
    <div className="dictionary-workspace">
      <div className="dictionary-search-bar">
        <div className="dictionary-search-bar__row">
          <div className="dictionary-lang-pills" role="tablist" aria-label="Lexicon language">
            {languageFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={language === f.id}
                className={
                  language === f.id
                    ? 'dictionary-lang-pills__btn dictionary-lang-pills__btn--active'
                    : 'dictionary-lang-pills__btn'
                }
                onClick={() => setLanguage(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="dictionary-search-bar__query-wrap">
            <div className="dictionary-search-bar__query">
              <AppIcon name="searchOutline" size={15} className="dictionary-search-bar__search-icon" />
              <input
                type="search"
                className="dictionary-search-bar__input"
                placeholder="Search by number, word, or gloss…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Dictionary search"
              />
            </div>
          </div>
          <label className="order-ribbon__field order-ribbon__field--select dictionary-search-bar__translation">
            <span className="adw-section-label">Translation</span>
            <AdwSelect
              value={translation || translationOptions[0]?.value || ''}
              options={
                translationOptions.length > 0 ? translationOptions : [{ value: '', label: 'None' }]
              }
              aria-label="Bible translation for scripture quotes"
              onChange={(id) => {
                setTranslation(id)
                saveBibleTranslation(id)
              }}
            />
          </label>
        </div>
      </div>

      <div className="dictionary-workspace__body">
      <aside className="dictionary-sidebar">
        {progress.lexiconSearchPhase === 'error' ? (
          <p className="dictionary-sidebar__status dictionary-sidebar__status--error adw-caption">
            {progress.message ?? 'Could not build lexicon search index.'}
          </p>
        ) : null}
        {progress.lexiconSearchPhase === 'building' ? (
          <p className="dictionary-sidebar__status adw-caption">
            Preparing search index… {lexiconSearchPct}%
          </p>
        ) : null}
        {progress.phase === 'building' ? (
          <p className="dictionary-sidebar__status adw-caption">
            Building verse index… {progressPct}%
          </p>
        ) : null}
        {progress.phase === 'error' ? (
          <p className="dictionary-sidebar__status dictionary-sidebar__status--error adw-caption">
            {progress.message ?? 'Could not build scripture index.'}
          </p>
        ) : null}

        <p className="dictionary-sidebar__count adw-caption">
          {listLoading
            ? 'Loading entries…'
            : query.trim()
              ? `${listTotal.toLocaleString()} match(es) · showing ${listEntries.length.toLocaleString()}`
              : `${listTotal.toLocaleString()} entries · showing ${listEntries.length.toLocaleString()}`}
        </p>
        <ul
          ref={listScrollRef}
          className="dictionary-entry-list"
          role="listbox"
          aria-label="Lexicon entries"
          onScroll={onListScroll}
        >
          {listEntries.map((item) => {
            const active = item.id === selectedId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={
                    active
                      ? 'dictionary-entry-list__item dictionary-entry-list__item--active'
                      : 'dictionary-entry-list__item'
                  }
                  draggable
                  onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                    const live = getDictionaryLiveContent()
                    if (live && live.strongs.replace(/\s/g, '').toUpperCase() === item.id.replace(/\s/g, '').toUpperCase()) {
                      writeSequenceDrag(event.dataTransfer, { op: 'insert', draft: { kind: 'dictionary', ...live } })
                      return
                    }
                    writeSequenceDrag(event.dataTransfer, { op: 'insert', draft: { kind: 'dictionary-ref', id: item.id } })
                  }}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="dictionary-entry-list__strongs">{formatStrongsDisplay(item.id)}</span>
                  <span className="dictionary-entry-list__lemma" dir="auto">
                    {item.name.split(',')[0]?.trim() ?? item.name}
                  </span>
                  <span className="dictionary-entry-list__hint">{primarySenseLabel(item)}</span>
                </button>
              </li>
            )
          })}
          {listLoading ? (
            <li className="dictionary-entry-list__loading">
              <span className="adw-spinner adw-spinner--sm" aria-hidden />
            </li>
          ) : null}
          {!listLoading && listLoadingMore ? (
            <li className="dictionary-entry-list__loading">
              <span className="adw-spinner adw-spinner--sm" aria-hidden />
              <span className="adw-caption">Loading more…</span>
            </li>
          ) : null}
        </ul>
      </aside>

      <section className="dictionary-detail" aria-live="polite">
        {!selectedId ? (
          <p className="adw-caption">Select an entry from the list.</p>
        ) : entryLoading && !entry ? (
          <p className="adw-caption">Loading entry…</p>
        ) : !entry ? (
          <p className="adw-caption">Entry not found.</p>
        ) : (
          <>
            <header className="dictionary-detail__header">
              <div className="dictionary-detail__title-row">
                <h1 className="dictionary-detail__strongs">{formatStrongsDisplay(entry.id)}</h1>
                <span className={`dictionary-detail__badge dictionary-detail__badge--${entry.language}`}>
                  {entry.language}
                </span>
              </div>
              {primarySense ? (
                <>
                  <p className="dictionary-detail__lemma" dir="auto">
                    {primarySense.lemma}
                  </p>
                  <dl className="dictionary-detail__meta">
                    {primarySense.transliteration ? (
                      <>
                        <dt>Transliteration</dt>
                        <dd>{primarySense.transliteration}</dd>
                      </>
                    ) : null}
                    {primarySense.partOfSpeech ? (
                      <>
                        <dt>Part of speech</dt>
                        <dd>{primarySense.partOfSpeech}</dd>
                      </>
                    ) : null}
                    {primarySense.gloss ? (
                      <>
                        <dt>Gloss</dt>
                        <dd>{primarySense.gloss}</dd>
                      </>
                    ) : null}
                  </dl>
                </>
              ) : null}
            </header>

            <div className="dictionary-detail__senses">
              {entry.senses.map((sense) => (
                <article key={sense.id} className="dictionary-sense adw-card">
                  {entry.senses.length > 1 ? (
                    <h2 className="dictionary-sense__title">{sense.gloss ?? sense.id}</h2>
                  ) : null}
                  <pre className="dictionary-sense__definition">{sense.definition}</pre>
                </article>
              ))}
            </div>

            <section className="dictionary-scripture">
              <div className="dictionary-scripture__toolbar">
                <h2 className="adw-title-3">In scripture</h2>
                <div className="dictionary-scripture__filters">
                  <label className="order-ribbon__field order-ribbon__field--select">
                    <span className="adw-section-label">Book</span>
                    <AdwSelect
                      value={scriptureBook}
                      options={bookOptions}
                      aria-label="Filter occurrences by book"
                      onChange={setScriptureBook}
                    />
                  </label>
                  <label className="order-ribbon__field order-ribbon__field--select">
                    <span className="adw-section-label">Chapter</span>
                    <AdwSelect
                      value={scriptureChapter}
                      options={chapterOptions}
                      disabled={scriptureBook === 'all'}
                      aria-label="Filter occurrences by chapter"
                      onChange={setScriptureChapter}
                    />
                  </label>
                </div>
              </div>
              {progress.phase === 'building' ? (
                <p className="adw-caption">
                  Scripture references appear after the verse index finishes downloading (
                  {progressPct}%).
                </p>
              ) : scriptureLoading ? (
                <div className="dictionary-scripture__loading" aria-busy="true">
                  <span className="adw-spinner" aria-hidden />
                  <p className="adw-caption">Loading scripture references…</p>
                </div>
              ) : (
                <>
                  <p className="dictionary-scripture__count adw-caption">
                    Found in {occurrenceTotal.toLocaleString()} verses
                  </p>
                  <div className="dictionary-scripture__cards">
                    {occurrences.length === 0 ? (
                      <p className="adw-caption">No verses match these filters.</p>
                    ) : null}
                    {occurrences.map((occ) => (
                      <article key={`${occ.bookId}:${occ.chapter}:${occ.verse}`} className="dictionary-verse-card adw-card">
                        <h3 className="dictionary-verse-card__ref">{occ.reference}</h3>
                        <p className="dictionary-verse-card__text">{occ.verseText}</p>
                        {occ.words.length > 0 ? (
                          <div className="dictionary-verse-card__words" dir="rtl">
                            {occ.words.map((w, i) => (
                              <span
                                key={`${w.text}-${i}`}
                                className={
                                  w.isMatch
                                    ? 'dictionary-word-chip dictionary-word-chip--match'
                                    : 'dictionary-word-chip'
                                }
                                title={[w.transliteration, w.gloss].filter(Boolean).join(' · ')}
                              >
                                {w.text}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                  {occurrenceTotal > 8 ? (
                    <div className="dictionary-scripture__pager">
                      <button
                        type="button"
                        className="adw-button adw-button--flat"
                        disabled={occurrenceOffset <= 0 || scriptureLoading}
                        onClick={() => {
                          const requestId = ++scriptureRequestRef.current
                          setScriptureLoading(true)
                          void loadOccurrences(Math.max(0, occurrenceOffset - 8), requestId).finally(
                            () => {
                              if (scriptureRequestRef.current === requestId) {
                                setScriptureLoading(false)
                              }
                            }
                          )
                        }}
                      >
                        Previous
                      </button>
                      <span className="adw-caption">
                        {occurrenceOffset + 1}–{Math.min(occurrenceOffset + 8, occurrenceTotal)} of{' '}
                        {occurrenceTotal}
                      </span>
                      <button
                        type="button"
                        className="adw-button adw-button--flat"
                        disabled={occurrenceOffset + 8 >= occurrenceTotal || scriptureLoading}
                        onClick={() => {
                          const requestId = ++scriptureRequestRef.current
                          setScriptureLoading(true)
                          void loadOccurrences(occurrenceOffset + 8, requestId).finally(() => {
                            if (scriptureRequestRef.current === requestId) {
                              setScriptureLoading(false)
                            }
                          })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </>
        )}
      </section>
      </div>
    </div>
  )
}
