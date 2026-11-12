import { useCallback, useEffect, useState, type ReactElement } from 'react'
import catalogFile from '../../../../bundles/catalog.json'
import {
  libraryRows,
  parseLibraryCatalog,
  type LibraryList,
  type LibraryPreviewGroup,
  type LibraryPreviewImage,
  type LibraryProgress,
  type LibraryRow
} from '../../../shared/content-bundles'
import { loadLibrarySettings, saveLibrarySettings } from '../lib/library-settings'
import { AdwActionRow } from './AdwActionRow'
import { AdwAlertDialog } from './AdwAlertDialog'
import { AdwSwitch } from './AdwSwitch'

const libraryIcons = import.meta.glob('../../../../bundles/*/icon.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>

const previewImages = import.meta.glob('../../../../bundles/*/preview/**/*.{jpg,jpeg,png,webp}', {
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

function withShippedPreview(list: LibraryList): LibraryList {
  const shipped = shippedList()
  return {
    ...list,
    libraries: list.libraries.map((row) => {
      const local = shipped.libraries.find((item) => item.id === row.id)?.preview
      const remote = row.preview
      const remoteImages = remote?.some((group) => group.images && group.images.length > 0) ?? false
      const localImages = local?.some((group) => group.images && group.images.length > 0) ?? false
      const preview = remote && remote.length > 0 && (remoteImages || !localImages) ? remote : local
      return preview && preview.length > 0 ? { ...row, preview } : row
    })
  }
}

const previewOrigin = 'https://raw.githubusercontent.com/riandredev/orion/main/bundles'

function bundledPreview(id: string, src: string): string | undefined {
  const suffix = `/bundles/${id}/${src}`.replaceAll('\\', '/')
  const match = Object.entries(previewImages).find(([path]) => path.replaceAll('\\', '/').endsWith(suffix))
  return match?.[1]
}

function remotePreview(id: string, src: string, version: string): string {
  const path = src.split('/').map((part) => encodeURIComponent(part)).join('/')
  return `${previewOrigin}/${encodeURIComponent(id)}/${path}?v=${encodeURIComponent(version)}`
}

function PreviewThumb({
  id,
  version,
  image
}: {
  id: string
  version: string
  image: LibraryPreviewImage
}): ReactElement | null {
  const local = bundledPreview(id, image.src)
  const remote = remotePreview(id, image.src, version)
  const [src, setSrc] = useState(remote || local || '')
  if (!src) return null
  return (
    <img
      src={src}
      alt={image.alt}
      onError={() => {
        if (local && src !== local) setSrc(local)
        else setSrc('')
      }}
    />
  )
}

function PreviewThumbs({
  id,
  version,
  images
}: {
  id: string
  version: string
  images: LibraryPreviewImage[]
}): ReactElement | null {
  if (images.length === 0) return null
  return (
    <div className="library-detail__thumbs">
      {images.map((image) => (
        <PreviewThumb key={`${image.folder ?? ''}/${image.src}`} id={id} version={version} image={image} />
      ))}
    </div>
  )
}

function PreviewGroup({
  id,
  version,
  group
}: {
  id: string
  version: string
  group: LibraryPreviewGroup
}): ReactElement {
  const images = group.images ?? []
  const folders = images.some((image) => image.folder)
  if (!folders) {
    return images.length > 0 ? (
      <PreviewThumbs id={id} version={version} images={images} />
    ) : (
      <ul>
        {group.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  const names = [...group.items]
  for (const image of images) {
    if (image.folder && !names.includes(image.folder)) names.push(image.folder)
  }
  return (
    <div className="library-detail__folders">
      {names.map((name) => (
        <div key={name} className="library-detail__folder">
          <h4>{name}</h4>
          <PreviewThumbs id={id} version={version} images={images.filter((image) => image.folder === name)} />
        </div>
      ))}
    </div>
  )
}

function statusLabel(row: LibraryRow): string {
  if (row.status === 'update') {
    if (row.installedVersion === row.availableVersion) return `Installed · version ${row.installedVersion}`
    return `Installed ${row.installedVersion} · update ${row.availableVersion}`
  }
  if (row.status === 'installed') return `Installed · version ${row.installedVersion}`
  return `Not installed · version ${row.availableVersion}`
}

function LibraryDetail({
  row,
  busyId,
  progress,
  error,
  onBack,
  onInstall,
  onRemove
}: {
  row: LibraryRow
  busyId: string | null
  progress: LibraryProgress | null
  error: string | null
  onBack: () => void
  onInstall: () => void
  onRemove: () => void
}): ReactElement {
  const working = busyId === row.id
  const art = libraryArt(row.id)
  const label = row.status === 'update' ? 'Update' : row.status === 'installed' ? 'Installed' : 'Download'
  return (
    <div className="library-detail">
      <button type="button" className="adw-button adw-button--flat library-detail__back" onClick={onBack}>
        Libraries
      </button>
      <div className="library-detail__title">
        {art ? <img src={art} alt="" /> : null}
        <div>
          <h2>{row.name}</h2>
          <p className="adw-caption">{working && progress?.id === row.id ? progress.message : statusLabel(row)}</p>
        </div>
        <div className="library-detail__actions">
          {row.status !== 'available' ? (
            <button type="button" className="adw-button adw-button--destructive" disabled={busyId != null} onClick={onRemove}>
              Remove
            </button>
          ) : null}
          <button
            type="button"
            className={row.status === 'installed' ? 'adw-button' : 'adw-button adw-button--suggested'}
            disabled={working || busyId != null || row.status === 'installed'}
            onClick={onInstall}
          >
            {working && progress?.id === row.id
              ? progress.phase === 'installing'
                ? 'Installing'
                : 'Downloading'
              : label}
          </button>
        </div>
      </div>
      <p className="library-detail__summary">{row.summary}</p>
      {error ? <p className="order-new-folder__error adw-caption">{error}</p> : null}
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
      {row.preview?.map((group) => (
        <section key={group.label} className="library-detail__group">
          <h3>{group.label}</h3>
          <PreviewGroup id={row.id} version={row.availableVersion} group={group} />
        </section>
      ))}
    </div>
  )
}

export function LibrariesSettingsPanel(): ReactElement {
  const [list, setList] = useState<LibraryList>(shippedList)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [progress, setProgress] = useState<LibraryProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoUpdate, setAutoUpdate] = useState(() => loadLibrarySettings().autoUpdate)
  const [removeRow, setRemoveRow] = useState<LibraryRow | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const sync = (): void => setAutoUpdate(loadLibrarySettings().autoUpdate)
    window.addEventListener('orion-library-settings', sync)
    window.addEventListener('orion-profile-applied', sync)
    return () => {
      window.removeEventListener('orion-library-settings', sync)
      window.removeEventListener('orion-profile-applied', sync)
    }
  }, [])

  const applyList = useCallback((next: LibraryList) => {
    setList(withShippedPreview(next))
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

  const remove = (row: LibraryRow): void => {
    setError(null)
    setBusyId(row.id)
    void window.orion.uninstallLibrary(row.id).then(async (result) => {
      setBusyId(null)
      setRemoveRow(null)
      if (!result.ok) {
        setError(result.message)
        return
      }
      window.dispatchEvent(new CustomEvent('orion-libraries-changed'))
      await refresh()
    })
  }

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
      window.dispatchEvent(new CustomEvent('orion-libraries-changed'))
      await refresh()
    })
  }

  const open = list.libraries.find((row) => row.id === openId) ?? null

  return (
    <div className="settings-panel">
      {open ? (
        <LibraryDetail
          row={open}
          busyId={busyId}
          progress={progress}
          error={error}
          onBack={() => setOpenId(null)}
          onInstall={() => install(open)}
          onRemove={() => setRemoveRow(open)}
        />
      ) : (
        <>
          <h2 className="settings-panel__title">Libraries</h2>
          <p className="adw-caption">
            Download church content packs into this Orion install. A pack stays up to date here when its
            folders, hymns, or Bibles change. Files you have edited are left in place.
          </p>
          <div className="adw-card settings-libraries__auto">
            <AdwActionRow
              title="Update libraries automatically"
              subtitle="Download library updates when Orion opens."
              suffix={
                <AdwSwitch
                  checked={autoUpdate}
                  aria-label="Update libraries automatically"
                  onChange={(enabled) => {
                    setAutoUpdate(enabled)
                    saveLibrarySettings({ autoUpdate: enabled })
                  }}
                />
              }
            />
          </div>
          {list?.catalogError ? <p className="order-new-folder__error adw-caption">{list.catalogError}</p> : null}
          {error ? <p className="order-new-folder__error adw-caption">{error}</p> : null}
          {list.libraries.length === 0 ? (
            <p className="adw-caption settings-libraries__status">No libraries are published yet.</p>
          ) : (
            <div className="library-index">
              {list.libraries.map((row) => {
                const art = libraryArt(row.id)
                return (
                  <button key={row.id} type="button" className="library-index__item" onClick={() => setOpenId(row.id)}>
                    {art ? <img src={art} alt="" /> : <span className="library-index__mark" aria-hidden="true" />}
                    <span className="library-index__name">{row.name}</span>
                    <span className="adw-caption">{statusLabel(row)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
      <AdwAlertDialog
        open={removeRow != null}
        title={removeRow ? `Remove ${removeRow.name}?` : 'Remove library?'}
        body="Library files you have not edited are deleted. Files you changed are left in place."
        confirmLabel="Remove"
        destructive
        busy={busyId != null}
        onCancel={() => {
          if (busyId == null) setRemoveRow(null)
        }}
        onConfirm={() => {
          if (removeRow) remove(removeRow)
        }}
      />
    </div>
  )
}
