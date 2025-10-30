'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Icon, Select, TextInput } from '@gravity-ui/uikit'
import { MusicNote, Play } from '@gravity-ui/icons'
import { Hymn } from '@/app/types/hymn'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import useVerseStore from '@/lib/store'

const LANGUAGES = [
  { value: 'AFR', content: 'AFR' },
  { value: 'ENG', content: 'ENG' },
]

const HYMN_TYPES: Record<string, { value: string; content: string }[]> = {
  AFR: [
    { value: 'adventlofliedere', content: 'Advent Lofliedere' },
    { value: 'adventjeugliede', content: 'Advent Jeug Liede' },
  ],
  ENG: [
    { value: 'adventhymnal', content: 'Advent Hymnal' },
    { value: 'adventyouthsongs', content: 'Advent Youth Songs' },
  ],
}

export function HymnSelector() {
  const [language, setLanguage] = useState<string>('AFR')
  const [hymnType, setHymnType] = useState<string>('adventlofliedere')
  const [searchTerm, setSearchTerm] = useState('')
  const [hymns, setHymns] = useState<Hymn[]>([])
  const [selected, setSelected] = useState<Hymn | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const hymnTypeOptions = useMemo(() => HYMN_TYPES[language] || [], [language])

  const fetchHymns = useCallback(async (lang: string, type: string, searchValue = '') => {
    try {
      const list = await invoke<Hymn[]>('get_hymns', {
        language: lang,
        hymnType: type,
        searchValue,
      })
      setHymns(list || [])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load hymns')
    }
  }, [])

  useEffect(() => {
    fetchHymns(language, hymnType)
  }, [language, hymnType, fetchHymns])

  useEffect(() => {
    const t = setTimeout(() => {
      // Only query backend by number; titles are handled client-side
      const numeric = /^\d+$/.test(searchTerm.trim())
      if (searchTerm) fetchHymns(language, hymnType, numeric ? searchTerm : '')
      // auto-select by exact match: number or "number - title"; do not clear existing
      const trimmed = searchTerm.trim()
      const exact = hymns.find(h => {
        const num = h.number.toString()
        const both = `${h.number} - ${h.title}`
        return trimmed === num || trimmed === both
      })
      if (exact) setSelected(exact)
    }, 250)
    return () => clearTimeout(t)
  }, [searchTerm, language, hymnType, fetchHymns, hymns])

  const filtered = useMemo(() => {
    if (!searchTerm) return hymns
    const term = searchTerm.toLowerCase()
    return hymns.filter(h => h.number.toString().includes(term) || h.title.toLowerCase().includes(term))
  }, [hymns, searchTerm])

  const handleDisplay = async (h?: Hymn) => {
    const hymn = h ?? selected
    if (!hymn) return
    try {
      setLoading(true)
      useVerseStore.getState().resetAll()
      useVerseStore.getState().setTotalVerses(hymn.verses_count)
      useVerseStore.getState().setHasRefrain(hymn.has_refrain)

      const sequence: ('title' | 'verse' | 'refrain' | 'blank')[] = ['title']
      for (let i = 1; i <= hymn.verses_count; i++) {
        sequence.push('verse')
        if (hymn.has_refrain) sequence.push('refrain')
      }
      useVerseStore.getState().setSequence(sequence)
      useVerseStore.getState().setActiveVerse(0)

      await invoke('display_hymn', {
        language: hymn.language,
        hymnType: hymn.hymn_type,
        hymnNumber: hymn.number.toString(),
      })
      toast.success(`Displaying hymn ${hymn.number}`)
    } catch (e) {
      console.error(e)
      toast.error('Failed to display hymn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Icon data={MusicNote} size={20} />
        <span className="text-foreground text-base font-medium">Hymn Selector</span>
      </div>

      {/* Single inline bar: search first, then selects, then action (floating, no card) */}
      <div className="flex gap-0 items-stretch">
        <div className="flex-1 min-w-0 relative">
          <TextInput
            size="xl"
            value={searchTerm}
            onUpdate={(v) => {
              setSearchTerm(v)
              setShowResults(Boolean(v && v.trim().length))
            }}
            placeholder="Search by number or title"
            startContent={<span className="px-2"><Icon data={MusicNote} size={16} /></span>}
            hasClear
            onClearClick={() => {
              setSearchTerm('')
              setSelected(null)
              setShowResults(false)
            }}
            pin="round-clear"
            onKeyDown={(e) => {
              if (filtered.length === 1) {
                const only = filtered[0]
                if (e.key === 'Tab') {
                  e.preventDefault()
                  setSelected(only)
                  setSearchTerm(`${only.number} - ${only.title}`)
                  setShowResults(false)
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setSelected(only)
                  setSearchTerm(`${only.number} - ${only.title}`)
                  setShowResults(false)
                  handleDisplay(only)
                }
              }
            }}
          />
          {showResults && filtered.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md z-50 max-h-72 overflow-auto">
              {filtered.map((h) => (
                <button
                  key={`${h.language}-${h.hymn_type}-${h.number}`}
                  onClick={() => {
                    setSelected(h)
                    setSearchTerm(`${h.number} - ${h.title}`)
                    setShowResults(false)
                  }}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    selected && selected.number === h.number && selected.hymn_type === h.hymn_type
                      ? 'bg-primary/5'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{h.number}</span>
                      <span className="text-sm">{h.title}</span>
                    </div>
                    {h.key_signature && (
                      <span className="text-xs text-muted-foreground">{h.key_signature}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <Select
          size="xl"
          filterable={false}
          value={[language]}
          options={LANGUAGES}
          onUpdate={(vals) => {
            const v = vals[0] as string
            setLanguage(v)
            const firstType = HYMN_TYPES[v]?.[0]?.value || ''
            setHymnType(firstType)
            setSelected(null)
          }}
          pin="brick-brick"
        />
        <Select
          size="xl"
          filterable={false}
          value={[hymnType]}
          options={hymnTypeOptions}
          onUpdate={(vals) => {
            setHymnType(vals[0] as string)
            setSelected(null)
          }}
          pin="clear-clear"
        />
        <Button
          view="action"
          size="xl"
          disabled={loading || !selected}
          onClick={() => {
            if (!selected) {
              const exact = hymns.find(h => h.number.toString() === searchTerm.trim())
              const choice = exact || filtered[0]
              if (choice) setSelected(choice)
              else return toast.error('No hymn found')
            }
            handleDisplay()
          }}
          className="px-4"
          pin="clear-round"
        >
          <Icon data={Play} size={16} />
        </Button>
      </div>
    </div>
  )
}

export default HymnSelector


