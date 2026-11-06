import { useCallback, useEffect, useState } from 'react'
import type { HymnalMeta } from '../../../shared/hymnal-types'
import { importHymnalFile, importHymnalFolder, importBibsoftMdb, listInstalledHymnals } from './hymnals-api'

export function useInstalledHymnals(): {
  hymnals: HymnalMeta[]
  refresh: () => Promise<void>
  importFile: () => Promise<HymnalMeta | null>
  importFolder: () => Promise<HymnalMeta | null>
  importBibsoftMdb: () => Promise<HymnalMeta[]>
} {
  const [hymnals, setHymnals] = useState<HymnalMeta[]>([])

  const refresh = useCallback(async () => {
    setHymnals(await listInstalledHymnals())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const importFile = useCallback(async () => {
    const meta = await importHymnalFile()
    await refresh()
    return meta
  }, [refresh])

  const importFolder = useCallback(async () => {
    const meta = await importHymnalFolder()
    await refresh()
    return meta
  }, [refresh])

  const importBibsoftMdbFile = useCallback(async () => {
    const metas = await importBibsoftMdb()
    await refresh()
    return metas
  }, [refresh])

  return { hymnals, refresh, importFile, importFolder, importBibsoftMdb: importBibsoftMdbFile }
}

export function hymnalSelectOptions(hymnals: HymnalMeta[]): { value: string; label: string }[] {
  return hymnals.map((h) => ({ value: h.id, label: h.label }))
}
