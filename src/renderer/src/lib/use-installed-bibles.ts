import { useCallback, useEffect, useState } from 'react'
import type { InstalledBibleInfo } from '../../../shared/bible-types'
import {
  downloadHelloAoTranslation,
  importBible,
  listInstalledBibles,
  removeBible
} from './bible-library-api'

export function useInstalledBibles(): {
  bibles: InstalledBibleInfo[]
  loading: boolean
  refresh: () => Promise<void>
  importNew: () => Promise<InstalledBibleInfo | null>
  downloadCatalog: (translationId: string) => Promise<InstalledBibleInfo>
  remove: (id: string) => Promise<boolean>
} {
  const [bibles, setBibles] = useState<InstalledBibleInfo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setBibles(await listInstalledBibles())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const importNew = useCallback(async () => {
    const added = await importBible()
    if (added) await refresh()
    return added
  }, [refresh])

  const downloadCatalog = useCallback(
    async (translationId: string) => {
      const added = await downloadHelloAoTranslation(translationId)
      await refresh()
      return added
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      const ok = await removeBible(id)
      if (ok) await refresh()
      return ok
    },
    [refresh]
  )

  return { bibles, loading, refresh, importNew, downloadCatalog, remove }
}
