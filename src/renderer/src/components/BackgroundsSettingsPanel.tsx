import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { displayFileUrl } from '../lib/file-url'
import type { BackgroundImportProgress } from '../../../shared/background-import'
import type { OrderFolderImage } from '../env'
import {
  resolveCategoryBackground,
  backgroundImagesMatch,
  getBackgroundSettings,
  updateCategoryBackground,
  useBackgroundSettings,
  type BackgroundCategoryId,
  type BackgroundFit,
  type BackgroundMode
} from '../lib/background-settings'
import { bibleBooks, getBookDisplayName } from '../../../shared/bible-books'
import { isAfrikaansBibleTranslation } from '../../../shared/bible-book-names-af'
import { findInstalledBible, loadBibleTranslation } from '../data/bible-translations'
import {
  getBibleBookBackgrounds,
  resolveBibleBackground,
  setBibleBookBackground,
  useBibleBookBackgrounds
} from '../lib/bible-book-backgrounds'
import { useInstalledBibles } from '../lib/use-installed-bibles'
import { AdwColorPicker, type AdwColorSwatch } from './AdwColorPicker'
import { AdwContextMenu, AdwContextMenuItem } from './AdwContextMenu'
import { AdwScale } from './AdwScale'
import { AdwSelect } from './AdwSelect'
import { AppIcon } from './AppIcon'
import { BackgroundStagePreview } from './BackgroundStagePreview'
import { BibleBookBackgroundCard } from './BibleBookBackgroundCard'

function LibraryThumb({
  path,
  name,
  selected,
  onSelect,
  onContextMenu
}: {
  path: string
  name: string
  selected: boolean
  onSelect: () => void
  onContextMenu: (event: MouseEvent) => void
}): ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const element = buttonRef.current
    const loadThumb = window.orion?.backgroundThumb
    if (!element || typeof loadThumb !== 'function') return
    let cancelled = false
    const load = (): void => {
      void loadThumb(path).then((thumb) => {
        if (!cancelled && thumb) setSrc(pathToFileUrl(thumb))
      })
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        load()
      },
      { rootMargin: '240px' }
    )
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [path])

  return (
    <button
      ref={buttonRef}
      type="button"
      className={selected ? 'settings-bg__thumb settings-bg__thumb--selected' : 'settings-bg__thumb'}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <div className="settings-bg__thumb-frame">
        {src ? <img src={src} alt="" decoding="async" /> : null}
      </div>
      <span className="settings-bg__thumb-name">{name}</span>
    </button>
  )
}

function pathToFileUrl(filePath: string): string {
  return displayFileUrl(filePath)
}

const CATEGORIES: {
  id: BackgroundCategoryId
  label: string
  description: string
}[] = [
  {
    id: 'defaults',
    label: 'Defaults',
    description: 'Fallback background used when a tab is set to follow defaults.'
  },
  {
    id: 'bible',
    label: 'Bible',
    description: 'Scripture projection backdrop and overlay styling.'
  },
  {
    id: 'hymns',
    label: 'Hymns',
    description: 'Lyrics and stanza background for congregational singing.'
  },
  {
    id: 'dictionary',
    label: 'Dictionary',
    description: 'Word study and definition slide background.'
  }
]

const SOLID_SWATCHES: AdwColorSwatch[] = [
  { color: '#000000', label: 'Pure black' },
  { color: '#0d1117', label: 'Deep slate' },
  { color: '#141418', label: 'Charcoal' },
  { color: '#1a1625', label: 'Midnight' },
  { color: '#0f1e2e', label: 'Deep navy' },
  { color: '#1b241e', label: 'Deep forest' }
]

const fitOptions: { value: BackgroundFit; label: string }[] = [
  { value: 'cover', label: 'Fill screen (cover)' },
  { value: 'contain', label: 'Fit entire image (contain)' }
]

export function BackgroundsSettingsPanel(): ReactElement {
  const settings = useBackgroundSettings()
  const [activeCategory, setActiveCategory] = useState<BackgroundCategoryId>('bible')
  const [library, setLibrary] = useState<OrderFolderImage[]>([])
  const [loading, setLoading] = useState(true)
  const [importBusy, setImportBusy] = useState(false)
  const [importProgress, setImportProgress] = useState<BackgroundImportProgress | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null)
  const [bookId, setBookId] = useState(bibleBooks[0]?.id ?? 'gen')
  const [applyToBook, setApplyToBook] = useState(true)
  const assignments = useBibleBookBackgrounds()
  const { bibles } = useInstalledBibles()
  const afrikaans = isAfrikaansBibleTranslation(findInstalledBible(bibles, loadBibleTranslation()))
  const bookName = getBookDisplayName(bookId, afrikaans)

  const refreshLibrary = useCallback(async () => {
    if (typeof window.orion?.listBackgroundImages !== 'function') {
      setLoading(false)
      return
    }
    try {
      const list = await window.orion.listBackgroundImages()
      setLibrary(list)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  useEffect(() => {
    if (typeof window.orion?.onBackgroundImportProgress !== 'function') return
    return window.orion.onBackgroundImportProgress(setImportProgress)
  }, [])

  const categoryMeta = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0]!
  const config = settings[activeCategory]
  const categoryBackground = resolveCategoryBackground(activeCategory, settings)
  const resolved =
    activeCategory === 'bible' && applyToBook
      ? resolveBibleBackground(bookId, settings)
      : categoryBackground

  const modeOptions: { value: BackgroundMode; label: string }[] =
    activeCategory === 'defaults'
      ? [
          { value: 'solid', label: 'Solid color' },
          { value: 'image', label: 'Background image' }
        ]
      : [
          { value: 'inherit', label: 'Use Default background' },
          { value: 'solid', label: 'Solid color' },
          { value: 'image', label: 'Background image' }
        ]

  async function handleAddBackground(): Promise<void> {
    if (importBusy || typeof window.orion?.importBackgroundImage !== 'function') return
    setImportBusy(true)
    setImportProgress(null)
    try {
      const imported = await window.orion.importBackgroundImage()
      if (!imported) return
      await refreshLibrary()
      updateCategoryBackground(activeCategory, {
        mode: 'image',
        imagePath: imported.path
      })
    } finally {
      setImportBusy(false)
      setImportProgress(null)
    }
  }

  function handleSelectLibraryImage(path: string): void {
    if (activeCategory === 'bible' && applyToBook) {
      setBibleBookBackground(bookId, path)
      return
    }
    updateCategoryBackground(activeCategory, {
      mode: 'image',
      imagePath: path
    })
  }

  async function deleteLibraryImage(path: string): Promise<void> {
    setMenu(null)
    if (typeof window.orion?.removeLibraryImage !== 'function') return
    const removed = await window.orion.removeLibraryImage(path)
    if (!removed) return
    const current = getBackgroundSettings()
    for (const id of ['defaults', 'bible', 'hymns', 'dictionary'] as const) {
      if (backgroundImagesMatch(current[id].imagePath, path)) {
        updateCategoryBackground(id, { imagePath: null })
      }
    }
    for (const [bookId, stored] of Object.entries(getBibleBookBackgrounds())) {
      if (backgroundImagesMatch(stored, path)) setBibleBookBackground(bookId, null)
    }
    await refreshLibrary()
  }

  return (
    <div className="settings-panel settings-bg">
      <div className="settings-panel__head-row">
        <div>
          <h2 className="settings-panel__title">Backgrounds</h2>
          <p className="adw-caption">
            Configure background images, solid colors, and text legibility dimming for Defaults,
            Bible, Hymns, and Dictionary.
          </p>
        </div>
        <button
          type="button"
          className="adw-button adw-button--suggested settings-bg__upload-btn"
          disabled={importBusy}
          onClick={() => void handleAddBackground()}
        >
          <AppIcon name="plus" size={16} />
          Import images…
        </button>
      </div>

      <div className="settings-bg__tabs" role="tablist" aria-label="Background categories">
        {CATEGORIES.map((cat) => {
          const isSelected = cat.id === activeCategory
          const catCfg = settings[cat.id]
          const badge =
            cat.id === 'defaults'
              ? catCfg.mode === 'image' && catCfg.imagePath
                ? 'Image'
                : 'Solid'
              : catCfg.mode === 'inherit'
                ? 'Default'
                : catCfg.mode === 'image' && catCfg.imagePath
                  ? 'Image'
                  : 'Solid'
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={
                isSelected
                  ? 'settings-bg__tab settings-bg__tab--active'
                  : 'settings-bg__tab'
              }
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="settings-bg__tab-label">{cat.label}</span>
              <span className="settings-bg__tab-mode">{badge}</span>
            </button>
          )
        })}
      </div>

      <div className="settings-bg__grid">
        <div className="adw-card settings-bg__controls-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">{categoryMeta.label} settings</h3>
            <p className="adw-caption">{categoryMeta.description}</p>
          </div>

          <div className="settings-bg__form">
            <div className="settings-bg__field">
              <span className="settings-field__label">Background mode</span>
              <AdwSelect
                value={config.mode}
                options={modeOptions}
                aria-label={`${categoryMeta.label} background mode`}
                onChange={(mode) => updateCategoryBackground(activeCategory, { mode })}
              />
            </div>

            {config.mode === 'inherit' && activeCategory !== 'defaults' ? (
              <p className="adw-caption settings-bg__inherit-note">
                Currently inheriting from <strong>Defaults</strong> (
                {settings.defaults.mode === 'image' && settings.defaults.imagePath
                  ? 'Background image'
                  : `Solid ${settings.defaults.solidColor}`}
                ). Switch mode above to customize {categoryMeta.label} independently.
              </p>
            ) : (
              <>
                <div className="settings-bg__field">
                  <span className="settings-field__label">Backdrop color</span>
                  <AdwColorPicker
                    value={config.solidColor}
                    swatches={SOLID_SWATCHES}
                    aria-label={`${categoryMeta.label} backdrop color`}
                    onChange={(solidColor) =>
                      updateCategoryBackground(activeCategory, { solidColor })
                    }
                  />
                </div>

                {config.mode === 'image' ? (
                  <>
                    <div className="settings-bg__field">
                      <div className="settings-bg__field-row">
                        <span className="settings-field__label">Dimming overlay</span>
                        <span className="adw-caption">{config.dimOpacity}%</span>
                      </div>
                      <AdwScale
                        min={0}
                        max={90}
                        step={5}
                        value={config.dimOpacity}
                        aria-label="Dimming overlay percentage"
                        onChange={(dimOpacity) =>
                          updateCategoryBackground(activeCategory, { dimOpacity })
                        }
                      />
                      <AdwColorPicker
                        value={config.dimColor}
                        swatches={SOLID_SWATCHES}
                        aria-label="Dimming overlay color"
                        onChange={(dimColor) =>
                          updateCategoryBackground(activeCategory, { dimColor })
                        }
                      />
                    </div>

                    <div className="settings-bg__field">
                      <span className="settings-field__label">Image scaling</span>
                      <AdwSelect
                        value={config.fit}
                        options={fitOptions}
                        aria-label="Image scaling"
                        onChange={(fit) => updateCategoryBackground(activeCategory, { fit })}
                      />
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="settings-bg__aside">
        <div className="adw-card settings-bg__preview-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">Live stage preview</h3>
            <p className="adw-caption">
              {activeCategory === 'bible' && applyToBook
                ? `${bookName} on the live stage.`
                : 'Sample layout matches live projection for this tab (16∶9).'}
            </p>
          </div>
          <BackgroundStagePreview
            category={activeCategory}
            backgroundColor={resolved.solidColor}
            backgroundImageUrl={
              resolved.imagePath ? pathToFileUrl(resolved.imagePath) : undefined
            }
            dimOpacity={resolved.dimOpacity}
            dimColor={resolved.dimColor}
            fit={resolved.fit}
          />
        </div>
        {activeCategory === 'bible' ? (
          <div className="adw-card settings-bg__controls-card">
            <BibleBookBackgroundCard
              bookId={bookId}
              onBookId={setBookId}
              assignedName={
                library.find((image) => backgroundImagesMatch(assignments[bookId], image.path))?.name ?? null
              }
            />
          </div>
        ) : null}
        </div>
      </div>

      <div className="adw-card settings-panel__card settings-bg__library-card">
        <div className="settings-bg__library-head">
          <div>
            <h3 className="settings-bg__subtitle">Background image library</h3>
            <p className="adw-caption">
              {activeCategory === 'bible' && applyToBook
                ? `Click an image to use it for ${bookName}.`
                : `Click an image to use it for ${categoryMeta.label}.`}
            </p>
          </div>
          <div className="settings-bg__library-actions">
            <button
              type="button"
              className="adw-button adw-button--suggested"
              disabled={importBusy}
              onClick={() => void handleAddBackground()}
            >
              <AppIcon name="plus" size={16} />
              Import images…
            </button>
            {config.imagePath ? (
            <button
              type="button"
              className="adw-button adw-button--flat"
              onClick={() =>
                updateCategoryBackground(activeCategory, {
                  mode: 'solid',
                  imagePath: null
                })
              }
            >
              Clear image
            </button>
            ) : null}
          </div>
        </div>

        {activeCategory === 'bible' ? (
          <div className="settings-bg__apply" role="radiogroup" aria-label="Apply the clicked image to">
            <button
              type="button"
              role="radio"
              aria-checked={applyToBook}
              className="settings-bg__field settings-bg__apply-row"
              onClick={() => setApplyToBook(true)}
            >
              <span className="settings-field__label">{bookName}</span>
              {applyToBook ? <span className="settings-bg__apply-mark">✓</span> : <span />}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!applyToBook}
              className="settings-bg__field settings-bg__apply-row"
              onClick={() => setApplyToBook(false)}
            >
              <span className="settings-field__label">Bible background</span>
              {!applyToBook ? <span className="settings-bg__apply-mark">✓</span> : <span />}
            </button>
          </div>
        ) : null}

        {importProgress && importProgress.total > 0 ? (
          <div className="settings-bg__import-progress">
            <div className="settings-bg__field-row">
              <span className="adw-caption">
                Copying {importProgress.current} of {importProgress.total}
              </span>
              <span className="adw-caption settings-bg__import-name">{importProgress.name}</span>
            </div>
            <div
              className="adw-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={importProgress.total}
              aria-valuenow={importProgress.current}
              aria-label="Image import"
            >
              <span
                className="adw-progress-bar__fill"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="adw-caption">Loading images…</p>
        ) : library.length === 0 ? (
          <p className="adw-caption">No background images yet. Use Import images to add some.</p>
        ) : (
          <div className="settings-bg__library-grid">
            {library.map((img) => {
              const selected =
                activeCategory === 'bible' && applyToBook
                  ? backgroundImagesMatch(assignments[bookId], img.path)
                  : backgroundImagesMatch(config.imagePath, img.path)
              return (
                <LibraryThumb
                  key={img.path}
                  path={img.path}
                  name={img.name}
                  selected={selected}
                  onSelect={() => handleSelectLibraryImage(img.path)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setMenu({ x: event.clientX, y: event.clientY, path: img.path })
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
      {menu ? (
        <AdwContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <AdwContextMenuItem
            label="Delete"
            destructive
            onSelect={() => void deleteLibraryImage(menu.path)}
          />
        </AdwContextMenu>
      ) : null}
    </div>
  )
}
