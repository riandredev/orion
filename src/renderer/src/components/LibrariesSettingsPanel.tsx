import { useCallback, useEffect, useState, type ReactElement } from 'react'
import catalogFile from '../../../../bundles/catalog.json'
import {
  libraryRows,
  parseLibraryCatalog,
  type LibraryList,
  type LibraryProgress,
  type LibraryRow
} from '../../../shared/content-bundles'
import { AdwActionRow } from './AdwActionRow'

const libraryIcons = import.meta.glob('../../../../bundles/*/icon.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>

function libraryArt(id: string): string | undefined {
  const suffix = `/bundles/${id}/icon.png`
  const match = Object.entries(libraryIcons).find(([path]) => path.replaceAll('\\', '/').endsWith(suffix))
  return match?.[1]
}

function shippedList(): LibraryList {
  const libraries = libraryRows(parseLibraryCatalog(catalogFile) ?? [], [])
  return { libraries, updates: 0, catalogError: null }
}

function statusLabel(row: LibraryRow): string {
  if (row.status === 'update') return `Installed ${row.installedVersion} · update ${row.availableVersion}`
  if (row.status === 'installed') return `Installed · version ${row.installedVersion}`
  return `Not installed · version ${row.availableVersion}`
}

export function LibrariesSettingsPanel(): ReactElement {
  const [list, setList] = useState<LibraryList>(shippedList)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [progress, setProgress] = useState<LibraryProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyList = useCallback((next: LibraryList) => {
    setList(next)
    window.dispatchEvent(new CustomEvent('orion-libraries-changed'))
  }, [])

  const refresh = useCallback(async () => {
    applyList(await window.orion.listLibraries())
  }, [applyList])

  useEffect(() => {
    void refresh()
    const stopList = window.orion.onLibrariesList(applyList)
    const stopProgress = window.orion.onLibraryProgress((next) => {
      setProgress(next)
    })
    return () => {
      stopList()
      stopProgress()
    }
  }, [applyList, refresh])

  const install = (row: LibraryRow): void => {
    setError(null)
    setBusyId(row.id)
    setProgress({ id: row.id, phase: 'downloading', percent: 0, message: 'Downloading…' })
    void window.orion.installLibrary(row.id).then(async (result) => {
      setBusyId(null)
      setProgress(null)
      if (!result.ok) {
        setError(result.message)
        return
      }
      await refresh()
    })
  }

  return (
    <div className="settings-panel">
      <h2 className="settings-panel__title">Libraries</h2>
      <p className="adw-caption">
        Download church content packs into this Orion install. A pack stays up to date here when its
        folders, hymns, or Bibles change. Files you have edited are left in place.
      </p>
      {list?.catalogError ? <p className="order-new-folder__error adw-caption">{list.catalogError}</p> : null}
      {error ? <p className="order-new-folder__error adw-caption">{error}</p> : null}
      <div className="adw-card settings-libraries">
        {list.libraries.length === 0 ? (
          <p className="adw-caption settings-libraries__status">No libraries are published yet.</p>
        ) : (
          list.libraries.map((row) => {
            const working = busyId === row.id
            const label = row.status === 'update' ? 'Update' : row.status === 'installed' ? 'Installed' : 'Download'
            const art = libraryArt(row.id)
            return (
              <AdwActionRow
                key={row.id}
                className="library-row"
                title={row.name}
                prefix={
                  art ? <img className="library-row__art" src={art} alt="" /> : null
                }
                subtitle={
                  <>
                    {row.summary}
                    <span className="library-row__meta">
                      {working && progress?.id === row.id ? progress.message : statusLabel(row)}
                    </span>
                    {working && progress?.id === row.id ? (
                      <span
                        className="library-row__progress adw-progress-bar"
                        role="progressbar"
                        aria-valuenow={progress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span className="adw-progress-bar__fill" style={{ width: `${progress.percent}%` }} />
                      </span>
                    ) : null}
                  </>
                }
                suffix={
                  <button
                    type="button"
                    className={
                      row.status === 'installed'
                        ? 'adw-button'
                        : 'adw-button adw-button--suggested'
                    }
                    disabled={working || busyId != null || row.status === 'installed'}
                    onClick={() => install(row)}
                  >
                    {working ? (progress?.phase === 'installing' ? 'Installing' : 'Downloading') : label}
                  </button>
                }
              />
            )
          })
        )}
      </div>
    </div>
  )
}
