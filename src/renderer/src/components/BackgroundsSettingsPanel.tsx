import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { OrderFolderImage } from '../env'
import {
  resolveCategoryBackground,
  updateCategoryBackground,
  useBackgroundSettings,
  type BackgroundCategoryId,
  type BackgroundFit,
  type BackgroundMode
} from '../lib/background-settings'
import { AdwColorPicker, type AdwColorSwatch } from './AdwColorPicker'
import { AdwScale } from './AdwScale'
import { AdwSelect } from './AdwSelect'
import { AppIcon } from './AppIcon'
import { BackgroundStagePreview } from './BackgroundStagePreview'

function pathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
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

  const categoryMeta = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0]!
  const config = settings[activeCategory]
  const resolved = resolveCategoryBackground(activeCategory, settings)

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
    if (typeof window.orion?.importBackgroundImage !== 'function') return
    const imported = await window.orion.importBackgroundImage()
    if (!imported) return
    await refreshLibrary()
    updateCategoryBackground(activeCategory, {
      mode: 'image',
      imagePath: imported.path
    })
  }

  function handleSelectLibraryImage(path: string): void {
    updateCategoryBackground(activeCategory, {
      mode: 'image',
      imagePath: path
    })
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

        <div className="adw-card settings-bg__preview-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">Live stage preview</h3>
            <p className="adw-caption">
              Sample layout matches live projection for this tab (16∶9).
            </p>
          </div>
          <BackgroundStagePreview
            category={activeCategory}
            backgroundColor={resolved.solidColor}
            backgroundImageUrl={
              resolved.imagePath ? pathToFileUrl(resolved.imagePath) : undefined
            }
            dimOpacity={resolved.dimOpacity}
            fit={resolved.fit}
          />
        </div>
      </div>

      <div className="adw-card settings-panel__card settings-bg__library-card">
        <div className="settings-bg__library-head">
          <div>
            <h3 className="settings-bg__subtitle">Background image library</h3>
            <p className="adw-caption">
              Import images, then click one to assign it to <strong>{categoryMeta.label}</strong>.
            </p>
          </div>
          <div className="settings-bg__library-actions">
            <button
              type="button"
              className="adw-button adw-button--suggested"
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

        {loading ? (
          <p className="adw-caption">Loading images…</p>
        ) : library.length === 0 ? (
          <p className="adw-caption">No background images yet. Use Import images to add some.</p>
        ) : (
          <div className="settings-bg__library-grid">
            {library.map((img) => {
              const selected =
                resolved.imagePath === img.path || config.imagePath === img.path
              return (
                <button
                  key={img.path}
                  type="button"
                  className={
                    selected
                      ? 'settings-bg__thumb settings-bg__thumb--selected'
                      : 'settings-bg__thumb'
                  }
                  onClick={() => handleSelectLibraryImage(img.path)}
                >
                  <div className="settings-bg__thumb-frame">
                    <img src={pathToFileUrl(img.path)} alt={img.name} loading="lazy" />
                  </div>
                  <span className="settings-bg__thumb-name">{img.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
