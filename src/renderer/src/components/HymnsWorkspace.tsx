import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type SetStateAction
} from 'react'
import { formatHymnActiveLabel, queryHymnSummaries } from '../../../shared/hymnal-query'
import { blurShortcutTarget } from '../lib/focus'
import {
  buildHymnProjectionSteps,
  clampProjectionStep,
  findRefrainStanzaIndex,
  offsetProjectionStep,
  orderStanzasForReading,
  projectionStepAt,
  projectionStepForStanzaIndex,
  projectionStepLabel,
  stanzaIndexAtProjectionStep
} from '../../../shared/hymnal-projection-sequence'
import { listHymnVerseNumbers, normalizeHymnEntry } from '../../../shared/hymnal-line-split'
import { formatHymnListMeta, countHymnStanzas } from '../../../shared/hymnal-summary'
import { lyricSlidePart, stanzaDisplayTagWithPart } from '../../../shared/hymnal-stanza-format'
import type { HymnEntry, HymnSummary, HymnalStanzaTagStyle } from '../../../shared/hymnal-types'
import { fetchHymnEntry, fetchHymnalIndex, deleteHymnEntry } from '../lib/hymnals-api'
import {
  loadHymnalStanzaTagStyle,
  loadSelectedHymnalId,
  saveHymnalStanzaTagStyle,
  saveSelectedHymnalId
} from '../lib/hymnals-settings'
import { hymnalSelectOptions, useInstalledHymnals } from '../lib/use-installed-hymnals'
import { clearHymnsRibbonActions, setHymnsRibbonActions } from '../lib/hymns-ribbon-actions'
import { hymnDraftFromEntry } from '../lib/sequence-materialize'
import { sequenceFollowsKeys, useHymnSequenceCue } from '../lib/sequence-cues'
import { writeSequenceDrag } from '../lib/sequence-drag'
import { publishHymnSequenceDraft } from '../lib/sequence-sources'
import { pushSequenceDraft } from '../lib/sequence-inbox'
import { getHymnLiveContent, setHymnActiveLabel, setHymnLiveContent } from '../lib/hymns-ribbon-sync'
import {
  getHymnsWorkspaceSession,
  patchHymnsWorkspaceSession
} from '../lib/hymns-workspace-session'
import {
  hymnPinFor,
  loadHymnPins,
  removeHymnPin,
  saveHymnPins,
  upsertHymnPin,
  type HymnPin
} from '../lib/hymn-pins'
import { AdwSelect } from './AdwSelect'
import { AdwActionRow } from './AdwActionRow'
import { AdwSwitch } from './AdwSwitch'
import { AdwAlertDialog } from './AdwAlertDialog'
import { AppIcon } from './AppIcon'
import { HymnEditorDialog } from './HymnEditorDialog'
import { HymnalsLibraryDialog } from './HymnalsLibraryDialog'

const tagStyleOptions = [
  { value: 'short' as const, label: '[V1] tags' },
  { value: 'long' as const, label: 'Verse tags' }
]

type HymnsWorkspaceProps = {
  onProjectStanza?: () => void
  onGoLive?: () => void
}

export function HymnsWorkspace({ onProjectStanza, onGoLive }: HymnsWorkspaceProps): ReactElement {
  const sessionSeed = getHymnsWorkspaceSession()
  const { hymnals, refresh, importFile, importFolder, importBibsoftMdb } = useInstalledHymnals()
  const hymnalOptions = useMemo(() => hymnalSelectOptions(hymnals), [hymnals])
  const [hymnalId, setHymnalIdState] = useState(() => loadSelectedHymnalId() || sessionSeed.hymnalId)
  const [tagStyle, setTagStyle] = useState<HymnalStanzaTagStyle>(() => loadHymnalStanzaTagStyle())
  const [query, setQuery] = useState(() => sessionSeed.query)
  const [selectedId, setSelectedIdState] = useState<string | null>(() => sessionSeed.selectedId)
  const [projectionStepIndex, setProjectionStepIndexState] = useState(
    () => sessionSeed.projectionStepIndex ?? 0
  )
  const [disabledVerseNumbers, setDisabledVerseNumbers] = useState<number[]>(
    () => sessionSeed.disabledVerseNumbers ?? []
  )
  const [includeRefrain, setIncludeRefrain] = useState(
    () => sessionSeed.includeRefrain !== false
  )
  const [includeTitle, setIncludeTitle] = useState(() => sessionSeed.includeTitle !== false)
  const [includeEnd, setIncludeEnd] = useState(() => sessionSeed.includeEnd !== false)
  const [indexRows, setIndexRows] = useState<HymnSummary[]>([])
  const [entry, setEntry] = useState<HymnEntry | null>(null)
  const [indexLoading, setIndexLoading] = useState(false)
  const [entryLoading, setEntryLoading] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorEntry, setEditorEntry] = useState<HymnEntry | null>(null)
  const [editorHymnalId, setEditorHymnalId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [pins, setPins] = useState<HymnPin[]>(() => loadHymnPins())
  const [pinsOnly, setPinsOnly] = useState(false)
  const listScrollRef = useRef<HTMLUListElement>(null)
  const entryLoadGen = useRef(0)
  const hymnCue = useHymnSequenceCue()
  const listFilterKeyRef = useRef<string | null>(`${sessionSeed.query}\0${hymnalId}`)

  const activeMeta = useMemo(() => hymnals.find((h) => h.id === hymnalId), [hymnals, hymnalId])

  const reloadHymnalIndex = useCallback(async () => {
    if (!hymnalId) {
      setIndexRows([])
      return
    }
    setIndexLoading(true)
    const rows = await fetchHymnalIndex(hymnalId)
    setIndexRows(rows)
    setIndexLoading(false)
  }, [hymnalId])

  useEffect(() => {
    if (hymnals.length === 0) return
    if (hymnalId && hymnals.some((h) => h.id === hymnalId)) return
    const next = hymnals[0]?.id ?? ''
    setHymnalIdState(next)
    saveSelectedHymnalId(next)
  }, [hymnals, hymnalId])

  const setHymnalId = useCallback((id: string) => {
    setHymnalIdState(id)
    saveSelectedHymnalId(id)
    patchHymnsWorkspaceSession({ hymnalId: id, selectedId: null, stanzaIndex: 0, projectionStepIndex: 0 })
    setSelectedIdState(null)
    setProjectionStepIndexState(0)
  }, [])

  const applyHymnPlaySettings = useCallback((hymnId: string | null) => {
    const pin = hymnId ? hymnPinFor(loadHymnPins(), hymnalId, hymnId) : undefined
    const disabledVerseNumbers = pin?.disabledVerseNumbers ?? []
    const includeRefrain = pin?.includeRefrain ?? true
    const includeTitle = pin?.includeTitle !== false
    const includeEnd = pin?.includeEnd !== false
    patchHymnsWorkspaceSession({
      selectedId: hymnId,
      stanzaIndex: 0,
      projectionStepIndex: 0,
      disabledVerseNumbers,
      includeRefrain,
      includeTitle,
      includeEnd
    })
    setProjectionStepIndexState(0)
    setDisabledVerseNumbers(disabledVerseNumbers)
    setIncludeRefrain(includeRefrain)
    setIncludeTitle(includeTitle)
    setIncludeEnd(includeEnd)
  }, [hymnalId])

  const setSelectedId = useCallback((value: SetStateAction<string | null>) => {
    setSelectedIdState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      if (next !== prev) queueMicrotask(() => applyHymnPlaySettings(next))
      return next
    })
  }, [applyHymnPlaySettings])

  const listEntries = useMemo(() => {
    const rows = queryHymnSummaries(indexRows, query)
    const pinned = new Set(
      pins.filter((pin) => pin.hymnalId === hymnalId).map((pin) => pin.hymnId)
    )
    return rows
      .map((row, index) => ({ row, index, pinned: pinned.has(row.id) }))
      .filter((item) => !pinsOnly || item.pinned)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.index - b.index)
      .map((item) => item.row)
  }, [hymnalId, indexRows, pins, pinsOnly, query])

  const projectionSteps = useMemo(
    () =>
      entry
        ? buildHymnProjectionSteps(entry.stanzas, {
            disabledVerseNumbers,
            includeRefrain,
            includeTitle,
            includeEnd
          })
        : [],
    [entry, disabledVerseNumbers, includeRefrain, includeTitle, includeEnd]
  )

  const activeProjectionStep = useMemo(
    () => projectionStepAt(projectionSteps, projectionStepIndex),
    [projectionSteps, projectionStepIndex]
  )

  const verseNumbers = useMemo(
    () => (entry ? listHymnVerseNumbers(entry.stanzas) : []),
    [entry]
  )

  const hasRefrain = useMemo(
    () => (entry ? findRefrainStanzaIndex(entry.stanzas) >= 0 : false),
    [entry]
  )

  const readingOrder = useMemo(
    () => (entry ? orderStanzasForReading(entry.stanzas) : []),
    [entry]
  )

  const stanzaVerseDisabled = useCallback(
    (stanza: HymnEntry['stanzas'][number]) => {
      if (stanza.kind !== 'verse' || stanza.verse == null) return false
      return disabledVerseNumbers.includes(stanza.verse)
    },
    [disabledVerseNumbers]
  )

  const applyProjectionStep = useCallback(
    (step: number) => {
      if (projectionSteps.length === 0) return
      const clamped = clampProjectionStep(step, projectionSteps.length)
      const stanzaIdx = stanzaIndexAtProjectionStep(projectionSteps, clamped)
      setProjectionStepIndexState(clamped)
      patchHymnsWorkspaceSession({ projectionStepIndex: clamped, stanzaIndex: stanzaIdx })
    },
    [projectionSteps]
  )

  const selectProjectionOffset = useCallback(
    (delta: number) => {
      if (projectionSteps.length === 0) return
      applyProjectionStep(offsetProjectionStep(projectionStepIndex, delta, projectionSteps.length))
    },
    [applyProjectionStep, projectionStepIndex, projectionSteps.length]
  )

  const selectStanzaByIndex = useCallback(
    (stanzaIdx: number) => {
      if (projectionSteps.length === 0) return
      applyProjectionStep(projectionStepForStanzaIndex(projectionSteps, stanzaIdx))
    },
    [applyProjectionStep, projectionSteps]
  )

  const selectedSummary = useMemo(
    () => listEntries.find((h) => h.id === selectedId) ?? null,
    [listEntries, selectedId]
  )

  const hymnAuthor = useMemo(() => {
    if (!entry) return undefined
    const name = entry.author?.trim() || selectedSummary?.author?.trim()
    return name || undefined
  }, [entry, selectedSummary])

  useEffect(() => {
    patchHymnsWorkspaceSession({ query })
  }, [query])

  useEffect(() => {
    return () => {
      patchHymnsWorkspaceSession({ listScrollTop: listScrollRef.current?.scrollTop ?? 0 })
    }
  }, [])

  useEffect(() => {
    const reloadPins = (): void => {
      const next = loadHymnPins()
      setPins(next)
      if (!selectedId) return
      const pin = hymnPinFor(next, hymnalId, selectedId)
      const disabled = pin?.disabledVerseNumbers ?? []
      const refrain = pin?.includeRefrain ?? true
      const title = pin?.includeTitle !== false
      const end = pin?.includeEnd !== false
      setDisabledVerseNumbers(disabled)
      setIncludeRefrain(refrain)
      setIncludeTitle(title)
      setIncludeEnd(end)
      patchHymnsWorkspaceSession({
        disabledVerseNumbers: disabled,
        includeRefrain: refrain,
        includeTitle: title,
        includeEnd: end
      })
      const savedHymnal = loadSelectedHymnalId()
      if (savedHymnal) setHymnalIdState(savedHymnal)
      setTagStyle(loadHymnalStanzaTagStyle())
    }
    window.addEventListener('orion-profile-applied', reloadPins)
    return () => window.removeEventListener('orion-profile-applied', reloadPins)
  }, [hymnalId, selectedId])

  const togglePin = useCallback(
    (hymnId: string) => {
      setPins((prev) => {
        const existing = hymnPinFor(prev, hymnalId, hymnId)
        const next = existing
          ? removeHymnPin(prev, hymnalId, hymnId)
          : upsertHymnPin(prev, {
              hymnalId,
              hymnId,
              disabledVerseNumbers: hymnId === selectedId ? disabledVerseNumbers : [],
              includeRefrain: hymnId === selectedId ? includeRefrain : true,
              includeTitle: hymnId === selectedId ? includeTitle : true,
              includeEnd: hymnId === selectedId ? includeEnd : true
            })
        saveHymnPins(next)
        return next
      })
    },
    [disabledVerseNumbers, hymnalId, includeEnd, includeRefrain, includeTitle, selectedId]
  )

  useEffect(() => {
    if (!hymnalId) {
      setIndexRows([])
      return
    }
    let cancelled = false
    setIndexLoading(true)
    void fetchHymnalIndex(hymnalId).then((rows) => {
      if (cancelled) return
      setIndexRows(rows)
      setIndexLoading(false)
      const filterKey = `${query}\0${hymnalId}`
      const filterChanged = listFilterKeyRef.current !== filterKey
      listFilterKeyRef.current = filterKey
      const filtered = queryHymnSummaries(rows, query)
      if (filterChanged) {
        if (listScrollRef.current) listScrollRef.current.scrollTop = 0
      } else {
        const top = getHymnsWorkspaceSession().listScrollTop
        requestAnimationFrame(() => {
          if (listScrollRef.current) listScrollRef.current.scrollTop = top
        })
      }
      setSelectedIdState((prev) => {
        if (query.trim()) return prev
        if (filtered.length === 0) return prev
        if (prev) return prev
        return filtered[0]?.id ?? null
      })
    })
    return () => {
      cancelled = true
    }
  }, [hymnalId, query])

  useEffect(() => {
    if (!selectedId) return
    requestAnimationFrame(() => {
      const root = listScrollRef.current
      if (!root) return
      const el = root.querySelector<HTMLElement>(`[data-hymn-id="${CSS.escape(selectedId)}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }, [selectedId, listEntries.length])

  useEffect(() => {
    if (!hymnalId || !selectedId) {
      setEntry(null)
      return
    }
    const gen = ++entryLoadGen.current
    let cancelled = false
    setEntryLoading(true)
    void fetchHymnEntry(hymnalId, selectedId).then((e) => {
      if (cancelled || gen !== entryLoadGen.current) return
      setEntry(e ? normalizeHymnEntry(e) : null)
      setEntryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [hymnalId, selectedId])

  useEffect(() => {
    if (!entry) return
    setProjectionStepIndexState(0)
    patchHymnsWorkspaceSession({ projectionStepIndex: 0 })
  }, [entry?.id])

  useEffect(() => {
    if (!entry || projectionSteps.length === 0) return
    const stanzaIdx = projectionSteps[0]!.stanzaIndex
    patchHymnsWorkspaceSession({ stanzaIndex: stanzaIdx })
  }, [entry?.id, projectionSteps])

  const stanzasScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const idx = activeProjectionStep?.stanzaIndex
    if (idx == null || idx < 0) return
    requestAnimationFrame(() => {
      stanzasScrollRef.current
        ?.querySelector<HTMLElement>(`[data-stanza-index="${idx}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [projectionStepIndex, activeProjectionStep?.stanzaIndex, entry?.id])

  useEffect(() => {
    if (!entry) return
    setProjectionStepIndexState((step) => {
      const clamped = clampProjectionStep(step, projectionSteps.length)
      if (clamped === step) return step
      const stanzaIdx = stanzaIndexAtProjectionStep(projectionSteps, clamped)
      patchHymnsWorkspaceSession({ projectionStepIndex: clamped, stanzaIndex: stanzaIdx })
      return clamped
    })
  }, [entry?.id, projectionSteps.length])

  useEffect(() => {
    if (!entry || !hymnalId) {
      if (!getHymnLiveContent()) setHymnActiveLabel('Select a hymn')
      return
    }
    const step = activeProjectionStep
    if (!step) {
      setHymnActiveLabel(`${entry.number} · ${entry.title}`)
      setHymnLiveContent(null)
      return
    }

    const base = {
      hymnalId,
      hymnId: entry.id,
      number: entry.number,
      title: entry.title,
      author: hymnAuthor,
      tagStyle
    }

    if (step.kind === 'title') {
      setHymnActiveLabel(`${entry.number} · ${entry.title} · Title`)
      setHymnLiveContent({
        ...base,
        slideKind: 'title',
        stanzaIndex: -1,
        stanzaTag: 'Title',
        stanzaKind: 'verse',
        lines: []
      })
      return
    }

    if (step.kind === 'end') {
      setHymnActiveLabel(`${entry.number} · ${entry.title} · End`)
      setHymnLiveContent({
        ...base,
        slideKind: 'end',
        stanzaIndex: -1,
        stanzaTag: 'End',
        stanzaKind: 'verse',
        lines: []
      })
      return
    }

    const idx = step.stanzaIndex
    const stanza = entry.stanzas[idx]
    if (!stanza) {
      setHymnActiveLabel(`${entry.number} · ${entry.title}`)
      setHymnLiveContent(null)
      return
    }
    const part = lyricSlidePart(entry.stanzas, idx)
    setHymnActiveLabel(formatHymnActiveLabel(entry, idx, tagStyle))
    setHymnLiveContent({
      ...base,
      slideKind: 'lyrics',
      stanzaIndex: idx,
      stanzaTag: stanzaDisplayTagWithPart(entry.stanzas, idx, tagStyle),
      stanzaKind: stanza.kind,
      verse: stanza.kind === 'verse' ? stanza.verse : undefined,
      ...(part && part.count > 1 ? { versePart: part.part, versePartCount: part.count } : {}),
      lines: step.lines
    })
  }, [entry, hymnalId, activeProjectionStep, tagStyle, hymnAuthor])

  const detailCounts = useMemo(() => (entry ? countHymnStanzas(entry.stanzas) : null), [entry])

  const rememberPinSettings = useCallback(
    (
      hymnId: string,
      play: {
        disabledVerseNumbers: number[]
        includeRefrain: boolean
        includeTitle: boolean
        includeEnd: boolean
      }
    ) => {
      setPins((prev) => {
        if (!hymnPinFor(prev, hymnalId, hymnId)) return prev
        const next = upsertHymnPin(prev, { hymnalId, hymnId, ...play })
        saveHymnPins(next)
        return next
      })
    },
    [hymnalId]
  )

  const resetSlidePosition = useCallback(() => {
    setProjectionStepIndexState(0)
    patchHymnsWorkspaceSession({ projectionStepIndex: 0 })
  }, [])

  const toggleVerseEnabled = useCallback((verseNum: number, enabled: boolean) => {
    setDisabledVerseNumbers((prev) => {
      const next = enabled ? prev.filter((n) => n !== verseNum) : [...prev, verseNum].sort((a, b) => a - b)
      patchHymnsWorkspaceSession({ disabledVerseNumbers: next })
      if (selectedId) {
        rememberPinSettings(selectedId, {
          disabledVerseNumbers: next,
          includeRefrain,
          includeTitle,
          includeEnd
        })
      }
      return next
    })
    resetSlidePosition()
  }, [includeEnd, includeRefrain, includeTitle, rememberPinSettings, resetSlidePosition, selectedId])

  const toggleRefrainIncluded = useCallback((on: boolean) => {
    setIncludeRefrain(on)
    patchHymnsWorkspaceSession({ includeRefrain: on })
    if (selectedId) {
      rememberPinSettings(selectedId, {
        disabledVerseNumbers,
        includeRefrain: on,
        includeTitle,
        includeEnd
      })
    }
    resetSlidePosition()
  }, [disabledVerseNumbers, includeEnd, includeTitle, rememberPinSettings, resetSlidePosition, selectedId])

  const toggleTitleIncluded = useCallback((on: boolean) => {
    setIncludeTitle(on)
    patchHymnsWorkspaceSession({ includeTitle: on })
    if (selectedId) {
      rememberPinSettings(selectedId, {
        disabledVerseNumbers,
        includeRefrain,
        includeTitle: on,
        includeEnd
      })
    }
    resetSlidePosition()
  }, [disabledVerseNumbers, includeEnd, includeRefrain, rememberPinSettings, resetSlidePosition, selectedId])

  const toggleEndIncluded = useCallback((on: boolean) => {
    setIncludeEnd(on)
    patchHymnsWorkspaceSession({ includeEnd: on })
    if (selectedId) {
      rememberPinSettings(selectedId, {
        disabledVerseNumbers,
        includeRefrain,
        includeTitle,
        includeEnd: on
      })
    }
    resetSlidePosition()
  }, [disabledVerseNumbers, includeRefrain, includeTitle, rememberPinSettings, resetSlidePosition, selectedId])

  useEffect(() => {
    if (projectionSteps.length === 0) return
    setProjectionStepIndexState((step) => {
      const clamped = clampProjectionStep(step, projectionSteps.length)
      if (clamped === step) return step
      const stanzaIdx = stanzaIndexAtProjectionStep(projectionSteps, clamped)
      patchHymnsWorkspaceSession({ projectionStepIndex: clamped, stanzaIndex: stanzaIdx })
      return clamped
    })
  }, [projectionSteps.length, disabledVerseNumbers, includeEnd, includeRefrain, includeTitle])

  const selectStanzaOffset = useCallback(
    (delta: number) => {
      selectProjectionOffset(delta)
    },
    [selectProjectionOffset]
  )

  useEffect(() => {
    if (!entry) {
      publishHymnSequenceDraft(null)
      return
    }
    publishHymnSequenceDraft(
      hymnDraftFromEntry(entry, hymnalId, {
        disabledVerseNumbers,
        includeRefrain,
        includeTitle,
        includeEnd
      })
    )
  }, [entry, hymnalId, disabledVerseNumbers, includeEnd, includeRefrain, includeTitle])

  useEffect(() => {
    if (!hymnCue) return
    if (hymnCue.hymnalId && hymnCue.hymnalId !== hymnalId) {
      setHymnalIdState(hymnCue.hymnalId)
      saveSelectedHymnalId(hymnCue.hymnalId)
    }
    setSelectedIdState(hymnCue.hymnId)
    setDisabledVerseNumbers(hymnCue.disabledVerseNumbers)
    setIncludeRefrain(hymnCue.includeRefrain)
    setIncludeTitle(hymnCue.includeTitle)
    setIncludeEnd(hymnCue.includeEnd)
    setProjectionStepIndexState(hymnCue.stepIndex)
    patchHymnsWorkspaceSession({
      hymnalId: hymnCue.hymnalId,
      selectedId: hymnCue.hymnId,
      projectionStepIndex: hymnCue.stepIndex,
      disabledVerseNumbers: hymnCue.disabledVerseNumbers,
      includeRefrain: hymnCue.includeRefrain,
      includeTitle: hymnCue.includeTitle,
      includeEnd: hymnCue.includeEnd
    })
  }, [hymnCue])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (document.querySelector('.hymns-workspace')?.closest('.tab-keep--hidden')) return
      if (sequenceFollowsKeys()) return
      if (document.querySelector('dialog[open]')) return
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        blurShortcutTarget(e.target)
        onGoLive?.()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        blurShortcutTarget(e.target)
        onProjectStanza?.()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        selectProjectionOffset(1)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        selectProjectionOffset(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onGoLive, onProjectStanza, selectProjectionOffset])

  useEffect(() => {
    setHymnsRibbonActions({
      prevSlide: () => selectStanzaOffset(-1),
      nextSlide: () => selectStanzaOffset(1),
      projectStanza: () => onProjectStanza?.(),
      goLive: () => onGoLive?.(),
      addToSequence: () => {
        if (!entry) return
        pushSequenceDraft(
          hymnDraftFromEntry(entry, hymnalId, {
            disabledVerseNumbers,
            includeRefrain,
            includeTitle,
            includeEnd
          })
        )
      }
    })
    return () => clearHymnsRibbonActions()
  }, [selectStanzaOffset, onProjectStanza, onGoLive, entry, hymnalId, disabledVerseNumbers, includeEnd, includeRefrain, includeTitle])

  const onImportFile = (): void => {
    void importFile().then((meta) => {
      if (meta) setHymnalId(meta.id)
      setLibraryOpen(false)
    })
  }

  const onImportFolder = (): void => {
    void importFolder().then((meta) => {
      if (meta) setHymnalId(meta.id)
      setLibraryOpen(false)
    })
  }

  const onImportBibsoftMdb = (): void => {
    void importBibsoftMdb().then((metas) => {
      const pick =
        metas.find((m) => m.language === 'af') ?? metas.sort((a, b) => b.hymnCount - a.hymnCount)[0]
      if (pick) setHymnalId(pick.id)
      setLibraryOpen(false)
    })
  }

  const openAddHymn = (): void => {
    if (!hymnalId) return
    setEditorHymnalId(hymnalId)
    setEditorEntry(null)
    setEditorOpen(true)
    setLibraryOpen(false)
  }

  const openEditHymn = (): void => {
    if (!entry || !hymnalId) return
    setEditorHymnalId(hymnalId)
    setEditorEntry(entry)
    setEditorOpen(true)
  }

  const onHymnSaved = (saved: HymnEntry): void => {
    const next = normalizeHymnEntry(saved)
    entryLoadGen.current += 1
    setEntry(next)
    setEditorEntry(next)
    setSelectedId(next.id)
    setEntryLoading(false)
    void reloadHymnalIndex()
    void refresh()
  }

  const confirmDeleteHymn = (): void => {
    if (!hymnalId || !selectedId || !entry) return
    void deleteHymnEntry(hymnalId, selectedId).then((ok) => {
      if (!ok) return
      setDeleteConfirm(false)
      setSelectedId(null)
      void reloadHymnalIndex()
      void refresh()
    })
  }

  return (
    <div className="hymns-workspace">
      <div className="hymns-search-bar">
        <div className="hymns-search-bar__row">
          <div className="hymns-search-bar__query-wrap">
            <div className="hymns-search-bar__query">
              <AppIcon name="searchOutline" size={15} className="hymns-search-bar__search-icon" />
              <input
                type="search"
                className="hymns-search-bar__input"
                placeholder="Number or title — e.g. 100, grace"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Hymn search"
              />
            </div>
          </div>
          <div className="hymns-search-bar__controls">
            <label className="order-ribbon__field order-ribbon__field--select">
              <span className="adw-section-label">Stanza tags</span>
              <AdwSelect
                value={tagStyle}
                options={tagStyleOptions}
                aria-label="Stanza tag style"
                onChange={(v) => {
                  const next = v === 'long' ? 'long' : 'short'
                  setTagStyle(next)
                  saveHymnalStanzaTagStyle(next)
                }}
              />
            </label>
            <div className="hymns-search-bar__hymnal-group">
              <label className="order-ribbon__field order-ribbon__field--select hymns-search-bar__hymnal">
                <span className="adw-section-label">Hymnal</span>
                <AdwSelect
                  value={hymnalId || hymnalOptions[0]?.value || ''}
                  options={hymnalOptions.length > 0 ? hymnalOptions : [{ value: '', label: 'None' }]}
                  disabled={hymnalOptions.length === 0}
                  aria-label={activeMeta ? `Hymnal: ${activeMeta.label}` : 'Hymnal'}
                  onChange={setHymnalId}
                />
              </label>
              <button
                type="button"
                className="adw-button adw-button--flat hymns-search-bar__hymnals-btn"
                aria-label="Manage hymnals and imports"
                onClick={() => setLibraryOpen(true)}
              >
                Hymnals…
              </button>
              <button
                type="button"
                className="adw-button hymns-search-bar__add-btn"
                onClick={openAddHymn}
              >
                Add hymn…
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hymns-workspace__body">
        <aside className="hymns-sidebar">
          <div className="hymns-sidebar__bar">
            <p className="hymns-sidebar__count adw-caption">
              {indexLoading
                ? 'Loading hymnal…'
                : pinsOnly
                  ? `${listEntries.length.toLocaleString()} pinned`
                  : `${listEntries.length.toLocaleString()} hymn${listEntries.length === 1 ? '' : 's'}`}
            </p>
            <div className="hymns-pin-filter" role="group" aria-label="Hymn list filter">
              <button
                type="button"
                className={pinsOnly ? 'hymns-pin-filter__btn' : 'hymns-pin-filter__btn hymns-pin-filter__btn--active'}
                aria-pressed={!pinsOnly}
                onClick={() => setPinsOnly(false)}
              >
                All
              </button>
              <button
                type="button"
                className={pinsOnly ? 'hymns-pin-filter__btn hymns-pin-filter__btn--active' : 'hymns-pin-filter__btn'}
                aria-pressed={pinsOnly}
                onClick={() => setPinsOnly(true)}
              >
                <AppIcon name="pin" size={12} />
                Pinned
              </button>
            </div>
          </div>
          <ul ref={listScrollRef} className="hymns-entry-list" role="listbox" aria-label="Hymns">
            {!indexLoading && listEntries.length === 0 ? (
              <li className="hymns-entry-list__empty adw-caption">
                {pinsOnly && !query.trim() ? 'No pinned hymns' : 'No matching hymns'}
              </li>
            ) : null}
            {listEntries.map((item) => {
              const active = item.id === selectedId
              const pinned = hymnPinFor(pins, hymnalId, item.id)
              const meta = formatHymnListMeta(item)
              return (
                <li key={item.id} className="hymns-entry-list__row">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-hymn-id={item.id}
                    className={
                      active
                        ? 'hymns-entry-list__item hymns-entry-list__item--selected'
                        : 'hymns-entry-list__item'
                    }
                    draggable
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      const saved = hymnPinFor(pins, hymnalId, item.id)
                      const toggles =
                        item.id === selectedId
                          ? { disabledVerseNumbers, includeRefrain, includeTitle, includeEnd }
                          : {
                              disabledVerseNumbers: saved?.disabledVerseNumbers ?? [],
                              includeRefrain: saved?.includeRefrain ?? true,
                              includeTitle: saved?.includeTitle !== false,
                              includeEnd: saved?.includeEnd !== false
                            }
                      if (item.id === selectedId && entry) {
                        writeSequenceDrag(event.dataTransfer, {
                          op: 'insert',
                          draft: hymnDraftFromEntry(entry, hymnalId, toggles)
                        })
                        return
                      }
                      writeSequenceDrag(event.dataTransfer, {
                        op: 'insert',
                        draft: {
                          kind: 'hymn-ref',
                          hymnalId,
                          hymnId: item.id,
                          number: item.number,
                          title: item.title,
                          ...toggles
                        }
                      })
                    }}
                    onClick={() => {
                      if (query.trim()) {
                        applyHymnPlaySettings(item.id)
                        setSelectedIdState(item.id)
                        setQuery('')
                        return
                      }
                      setSelectedId(item.id)
                    }}
                  >
                    <span className="hymns-entry-list__number">{item.number}</span>
                    <span className="hymns-entry-list__main">
                      <span className="hymns-entry-list__title">{item.title}</span>
                      {meta ? <span className="hymns-entry-list__meta adw-caption">{meta}</span> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={
                      pinned
                        ? 'hymns-entry-list__pin hymns-entry-list__pin--on'
                        : 'hymns-entry-list__pin'
                    }
                    aria-pressed={Boolean(pinned)}
                    aria-label={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                    onClick={() => togglePin(item.id)}
                  >
                    <AppIcon name="pin" size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="hymns-detail" aria-live="polite">
          {!selectedId ? (
            <p className="adw-caption">Select a hymn from the list.</p>
          ) : entryLoading && !entry ? (
            <p className="adw-caption">Loading hymn…</p>
          ) : !entry ? (
            <p className="adw-caption">Hymn not found.</p>
          ) : (
            <>
              <header className="hymns-detail__header">
                <div className="hymns-detail__heading">
                  <p className="hymns-detail__number adw-caption">Hymn {entry.number}</p>
                  <h1 className="hymns-detail__title">{entry.title}</h1>
                  {activeMeta ? (
                    <span
                      className={`hymns-detail__badge adw-caption hymns-detail__badge--${activeMeta.language}`}
                    >
                      {activeMeta.label}
                    </span>
                  ) : null}
                </div>
                <div className="hymns-detail__actions">
                  <button
                    type="button"
                    className={
                      hymnPinFor(pins, hymnalId, entry.id)
                        ? 'adw-button adw-button--flat hymns-detail__pin hymns-detail__pin--on'
                        : 'adw-button adw-button--flat hymns-detail__pin'
                    }
                    aria-pressed={Boolean(hymnPinFor(pins, hymnalId, entry.id))}
                    onClick={() => togglePin(entry.id)}
                  >
                    <AppIcon name="pin" size={14} />
                    {hymnPinFor(pins, hymnalId, entry.id) ? 'Pinned' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    className="adw-button adw-button--flat"
                    disabled={!entry}
                    onClick={openEditHymn}
                  >
                    Edit hymn…
                  </button>
                  <button
                    type="button"
                    className="adw-button adw-button--flat"
                    disabled={!entry}
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Delete
                  </button>
                </div>
              </header>
              <div className="hymns-detail__layout">
                <div ref={stanzasScrollRef} className="hymns-stanzas">
                  {readingOrder.map((index) => {
                    const stanza = entry.stanzas[index]!
                    const active =
                      activeProjectionStep?.kind === 'lyrics' && activeProjectionStep.stanzaIndex === index
                    const skipped = stanzaVerseDisabled(stanza)
                    const tag = stanzaDisplayTagWithPart(entry.stanzas, index, tagStyle)
                    return (
                      <button
                        key={`${tag}-${index}`}
                        type="button"
                        data-stanza-index={index}
                        className={
                          active
                            ? 'hymns-stanza hymns-stanza--active'
                            : skipped
                              ? 'hymns-stanza hymns-stanza--skipped'
                              : 'hymns-stanza'
                        }
                        onClick={() => selectStanzaByIndex(index)}
                      >
                        <span className="hymns-stanza__label">{tag}</span>
                        {stanza.lines.map((line, lineIndex) => (
                          <p key={lineIndex} className="hymns-stanza__line">
                            {line}
                          </p>
                        ))}
                      </button>
                    )
                  })}
                </div>
                <aside className="hymns-inspector" aria-label="Hymn settings">
                  <div className="adw-list-group">
                    <div className="adw-list-group__header">
                      <span>Slides</span>
                      {projectionSteps.length > 0 ? (
                        <span className="hymns-inspector__badge adw-caption">
                          {projectionStepIndex + 1} / {projectionSteps.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="adw-list-box">
                      {projectionSteps.length === 0 ? (
                        <AdwActionRow
                          title="No slides"
                          subtitle="Turn on at least one slide below"
                          suffix={<span />}
                        />
                      ) : (
                        projectionSteps.map((step, stepIdx) => {
                          const active = stepIdx === projectionStepIndex
                          const label = projectionStepLabel(entry.stanzas, step, tagStyle)
                          const preview =
                            step.kind === 'title'
                              ? entry.title
                              : step.kind === 'end'
                                ? ''
                                : (step.lines.find((l) => l.trim()) ?? '')
                          return (
                            <div
                              key={`${step.stanzaIndex}-${stepIdx}`}
                              className={active ? 'adw-list-row adw-list-row--current' : 'adw-list-row'}
                            >
                              <button
                                type="button"
                                className="adw-list-row__main bible-library-dialog__row-select"
                                aria-current={active ? 'true' : undefined}
                                onClick={() => applyProjectionStep(stepIdx)}
                              >
                                <span className="adw-list-row__title">{label}</span>
                                <span className="adw-list-row__subtitle">
                                  Slide {stepIdx + 1}
                                  {preview ? ` · ${preview.length > 48 ? `${preview.slice(0, 48)}…` : preview}` : ''}
                                </span>
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="adw-list-group">
                      <div className="adw-list-group__header">Slides to show</div>
                      <div className="adw-list-box">
                        <AdwActionRow
                          title="Title slide"
                          suffix={
                            <AdwSwitch
                              checked={includeTitle}
                              aria-label="Include title slide"
                              onChange={toggleTitleIncluded}
                            />
                          }
                        />
                        {verseNumbers.map((n) => {
                          const on = !disabledVerseNumbers.includes(n)
                          return (
                            <AdwActionRow
                              key={n}
                              title={`Verse ${n}`}
                              suffix={
                                <AdwSwitch
                                  checked={on}
                                  aria-label={`Include verse ${n}`}
                                  onChange={(checked) => toggleVerseEnabled(n, checked)}
                                />
                              }
                            />
                          )
                        })}
                        {hasRefrain ? (
                          <AdwActionRow
                            title="Refrain"
                            subtitle="After each verse"
                            suffix={
                              <AdwSwitch
                                checked={includeRefrain}
                                aria-label="Include refrain after each verse"
                                onChange={toggleRefrainIncluded}
                              />
                            }
                          />
                        ) : null}
                        <AdwActionRow
                          title="End slide"
                          suffix={
                            <AdwSwitch
                              checked={includeEnd}
                              aria-label="Include end slide"
                              onChange={toggleEndIncluded}
                            />
                          }
                        />
                      </div>
                    </div>

                  <div className="adw-list-group">
                    <div className="adw-list-group__header">About</div>
                    <div className="adw-list-box">
                      <AdwActionRow title="Number" suffix={<span className="hymns-inspector__value">{entry.number}</span>} />
                      <AdwActionRow
                        title="Slides"
                        suffix={<span className="hymns-inspector__value">{projectionSteps.length}</span>}
                      />
                      {detailCounts ? (
                        <AdwActionRow
                          title="Verses"
                          suffix={<span className="hymns-inspector__value">{detailCounts.verseCount}</span>}
                        />
                      ) : null}
                      {(entry.author?.trim() || selectedSummary?.author?.trim()) ? (
                        <AdwActionRow
                          title="Author"
                          suffix={
                            <span className="hymns-inspector__value hymns-inspector__value--wrap">
                              {entry.author?.trim() || selectedSummary?.author?.trim()}
                            </span>
                          }
                        />
                      ) : null}
                      {activeMeta ? (
                        <AdwActionRow
                          title="Hymnal"
                          suffix={<span className="hymns-inspector__value">{activeMeta.label}</span>}
                        />
                      ) : null}
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
      <HymnalsLibraryDialog
        open={libraryOpen}
        hymnals={hymnals}
        activeId={hymnalId}
        onClose={() => setLibraryOpen(false)}
        onSelect={setHymnalId}
        onImportFile={onImportFile}
        onImportFolder={onImportFolder}
        onImportBibsoftMdb={onImportBibsoftMdb}
        onAddHymn={openAddHymn}
      />
      <HymnEditorDialog
        open={editorOpen}
        hymnalId={editorHymnalId || hymnalId}
        entry={editorEntry}
        tagStyle={tagStyle}
        onClose={() => setEditorOpen(false)}
        onSaved={onHymnSaved}
      />
      <AdwAlertDialog
        open={deleteConfirm}
        title="Delete this hymn?"
        body="It will be removed from the hymnal on this computer."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={confirmDeleteHymn}
      />
    </div>
  )
}
