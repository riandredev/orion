'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useBibleVerseStore } from '@/lib/store'

type BibleQuickVerseButtonsProps = {
  referenceText?: string | null
  embedded?: boolean
}

const parseReference = (text?: string | null): { book: string; chapter: number } | null => {
  if (!text) return null
  // Accept formats like "John 3:16", "1 John 4:8", "Genesis 1"
  const match = text.match(/^(\d?\s?[A-Za-z\u00C0-\u024F\- ]+?)\s+(\d+)(?::\d+)?\s*$/)
  if (match) {
    const book = match[1].trim()
    const chapter = Number.parseInt(match[2], 10)
    if (!Number.isNaN(chapter)) return { book, chapter }
  }
  return null
}

export function BibleQuickVerseButtons({ referenceText, embedded = false }: BibleQuickVerseButtonsProps) {
  const [availableVerses, setAvailableVerses] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentVerse, setCurrentVerse } = useBibleVerseStore()

  const parsed = useMemo(() => parseReference(referenceText), [referenceText])

  useEffect(() => {
    const loadVerses = async () => {
      if (!parsed) {
        setAvailableVerses([])
        return
      }
      try {
        setLoading(true)
        setError(null)
        const count = await invoke<number>('get_verse_count', {
          book: parsed.book,
          chapter: parsed.chapter,
        })
        setAvailableVerses(Array.from({ length: count }, (_, i) => i + 1))
      } catch (e) {
        setError('Unable to load verses')
        setAvailableVerses([])
      } finally {
        setLoading(false)
      }
    }
    loadVerses()
  }, [parsed])

  const handleClick = useCallback(async (verseNum: number) => {
    if (!parsed) return
    try {
      const verse = await invoke<any>('get_bible_verse', {
        book: parsed.book,
        chapter: parsed.chapter,
        verse: verseNum,
      })
      if (verse) {
        setCurrentVerse(verse)
        const window = await WebviewWindow.getByLabel('bible-window-0')
        if (window) {
          await window.emit('update-verse', verse)
        }
      }
    } catch (e) {
      // no-op
    }
  }, [parsed, setCurrentVerse])

  if (embedded) {
    if (!parsed) return null
    return (
      <div>
        <div className={cn(
          'grid gap-2',
          availableVerses.length > 30 ? 'grid-cols-10' : availableVerses.length > 20 ? 'grid-cols-8' : 'grid-cols-6'
        )}>
          {loading ? (
            <div className="col-span-full text-sm text-muted-foreground">Loading verses…</div>
          ) : (
            availableVerses.map((n) => {
              const isActive = currentVerse && currentVerse.book === parsed.book && currentVerse.chapter === parsed.chapter && currentVerse.verse === n
              return (
                <Button
                  key={n}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={cn('h-8 px-0', isActive ? '' : 'bg-background')}
                  onClick={() => handleClick(n)}
                >
                  {n}
                </Button>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {parsed ? (
          <span>{parsed.book} {parsed.chapter}{currentVerse && currentVerse.book === parsed.book && currentVerse.chapter === parsed.chapter ? ` • current: ${currentVerse.verse}` : ''}</span>
        ) : (
          <span>Chapter verses</span>
        )}
      </div>
      <Card className="mt-2 p-3 bg-card-background border border-border min-h-[140px]">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : parsed ? (
          <div className={cn(
            'grid gap-2',
            availableVerses.length > 30 ? 'grid-cols-10' : availableVerses.length > 20 ? 'grid-cols-8' : 'grid-cols-6'
          )}>
            {loading ? (
              <div className="col-span-full text-sm text-muted-foreground">Loading verses…</div>
            ) : (
              availableVerses.map((n) => {
                const isActive = currentVerse && currentVerse.book === parsed.book && currentVerse.chapter === parsed.chapter && currentVerse.verse === n
                return (
                  <Button
                    key={n}
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    className={cn('h-8 px-0', isActive ? '' : 'bg-background')}
                    onClick={() => handleClick(n)}
                  >
                    {n}
                  </Button>
                )
              })
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Controls will appear here when Bible is active</div>
        )}
      </Card>
    </div>
  )
}

export default BibleQuickVerseButtons


