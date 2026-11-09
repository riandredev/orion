import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import type { OrionDisplayInfo } from '../../../shared/displays'
import {
  displayProjectionSignature,
  isDisplayProjectionEnabled,
  loadDisplayEnabledMap,
  rememberDisplays,
  setDisplayProjectionEnabled,
  type DisplayEnabledMap
} from '../lib/display-enabled'
import { buildLayoutMonitors, loadSavedLayoutPositions } from '../lib/display-layout'
import { AdwSwitch } from './AdwSwitch'
import { AppIcon } from './AppIcon'
import { DisplayArrangementCanvas } from './DisplayArrangementCanvas'

function formatResolution(bounds: OrionDisplayInfo['bounds']): string {
  return `${bounds.width} × ${bounds.height}`
}

function formatPosition(bounds: OrionDisplayInfo['bounds']): string {
  return `${bounds.x}, ${bounds.y}`
}

function DisplayRow({
  display,
  outputOrder,
  projectionEnabled,
  onToggleProjection
}: {
  display: OrionDisplayInfo
  outputOrder: number | null
  projectionEnabled: boolean
  onToggleProjection: (enabled: boolean) => void
}): ReactElement {
  return (
    <li className="settings-display-row">
      <div className="settings-display-row__head">
        <span className="settings-display-row__label">
          {outputOrder != null ? (
            <span className="settings-display-row__order">{outputOrder}</span>
          ) : null}
          {display.label}
        </span>
        <span className="settings-display-row__badges">
          {display.primary ? (
            <span className="settings-display-row__badge settings-display-row__badge--primary">
              Primary
            </span>
          ) : null}
          {display.internal ? (
            <span className="settings-display-row__badge">Internal</span>
          ) : (
            <span className="settings-display-row__badge settings-display-row__badge--external">
              External
            </span>
          )}
        </span>
      </div>
      <label className="settings-display-row__project-toggle adw-caption" htmlFor={`display-project-${display.id}`}>
        <AdwSwitch
          id={`display-project-${display.id}`}
          checked={projectionEnabled}
          aria-label="Use for projection"
          onChange={onToggleProjection}
        />
        Use for projection
      </label>
      <dl className="settings-display-row__meta adw-caption">
        <div>
          <dt>Resolution</dt>
          <dd>{formatResolution(display.bounds)}</dd>
        </div>
        <div>
          <dt>Work area</dt>
          <dd>{formatResolution(display.workArea)}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{formatPosition(display.bounds)}</dd>
        </div>
        <div>
          <dt>Scale</dt>
          <dd>{Math.round(display.scaleFactor * 100)}%</dd>
        </div>
        <div>
          <dt>Rotation</dt>
          <dd>{display.rotation}°</dd>
        </div>
        {display.refreshRate != null ? (
          <div>
            <dt>Refresh</dt>
            <dd>{display.refreshRate} Hz</dd>
          </div>
        ) : null}
        <div>
          <dt>ID</dt>
          <dd>{display.id}</dd>
        </div>
      </dl>
    </li>
  )
}

export function DisplaysSettingsPanel(): ReactElement {
  const [displays, setDisplays] = useState<OrionDisplayInfo[]>([])
  const [enabledMap, setEnabledMap] = useState<DisplayEnabledMap>(() => loadDisplayEnabledMap())
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const list = await window.orion.listDisplays()
      setDisplays(list)
      setEnabledMap(rememberDisplays(list))
    } catch {
      setError('Could not read connected displays.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return window.orion.onDisplaysChanged((list) => {
      setDisplays(list)
      setEnabledMap(rememberDisplays(list))
      setLoading(false)
      setError(null)
    })
  }, [refresh])

  useEffect(() => {
    const onProfile = (): void => {
      setEnabledMap(loadDisplayEnabledMap())
    }
    window.addEventListener('orion-profile-applied', onProfile)
    return () => window.removeEventListener('orion-profile-applied', onProfile)
  }, [])

  const orderById = useMemo(() => {
    const map = new Map<number, number>()
    for (const monitor of buildLayoutMonitors(displays, loadSavedLayoutPositions())) {
      if (isDisplayProjectionEnabled(monitor.display.id, enabledMap)) {
        map.set(monitor.display.id, monitor.order)
      }
    }
    return map
  }, [displays, enabledMap, layoutVersion])

  const onToggleProjection = (display: OrionDisplayInfo, enabled: boolean): void => {
    setEnabledMap(
      setDisplayProjectionEnabled(display.id, enabled, displayProjectionSignature(display))
    )
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel__head-row">
        <div>
          <h2 className="settings-panel__title">Displays</h2>
          <p className="adw-caption">
            Arrange monitors and choose which ones receive fullscreen projection when you send to
            outputs.
          </p>
        </div>
        <button
          type="button"
          className="adw-button adw-button--flat settings-display-refresh"
          onClick={() => {
            setLoading(true)
            void refresh()
          }}
          disabled={loading}
        >
          <AppIcon name="repeat" size={16} />
          Refresh
        </button>
      </div>

      <div className="adw-card settings-panel__card settings-display-card">
        {loading && displays.length === 0 ? (
          <p className="adw-caption settings-display-status">Detecting displays…</p>
        ) : null}
        {error ? (
          <p className="adw-caption settings-display-status settings-display-status--error">
            {error}
          </p>
        ) : null}
        {!loading && !error && displays.length === 0 ? (
          <p className="adw-caption settings-display-status">No displays reported.</p>
        ) : null}
        {displays.length > 0 ? (
          <>
            <DisplayArrangementCanvas
              displays={displays}
              onLayoutChange={() => setLayoutVersion((version) => version + 1)}
            />
            <p className="adw-caption settings-display-summary">
              {displays.length} display{displays.length === 1 ? '' : 's'} connected ·{' '}
              {[...orderById.values()].length} enabled for projection
            </p>
            <ul className="settings-display-list">
              {displays.map((display) => (
                <DisplayRow
                  key={display.id}
                  display={display}
                  outputOrder={orderById.get(display.id) ?? null}
                  projectionEnabled={isDisplayProjectionEnabled(
                    display.id,
                    enabledMap,
                    displayProjectionSignature(display)
                  )}
                  onToggleProjection={(enabled) => onToggleProjection(display, enabled)}
                />
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <p className="adw-caption settings-display-footnote">
        Disabled displays are skipped when you send content to outputs. Plugging in or removing a
        monitor updates this list automatically.
      </p>
    </div>
  )
}
