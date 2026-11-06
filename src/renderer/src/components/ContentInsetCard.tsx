import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { ProjectionContentInsetCategory } from '../../../shared/projection-content-insets'
import {
  PROJECTION_CONTENT_INSET_MAX,
  PROJECTION_CONTENT_INSET_MIN,
  type ProjectionContentInsetsByCategory,
  type ProjectionContentInsetsVmin
} from '../../../shared/projection-content-insets'
import {
  pushProjectionContentInsetsToMain,
  resetProjectionContentInsetsForCategory,
  setProjectionContentInsetsForCategory,
  updateProjectionContentInsetsForCategory,
  useProjectionContentInsetsByCategory
} from '../lib/projection-content-insets-settings'
import { AdwActionRow } from './AdwActionRow'
import { AdwScale } from './AdwScale'
import { AdwSwitch } from './AdwSwitch'

type Side = keyof ProjectionContentInsetsVmin

const SIDES: { key: Side; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' }
]

export function ContentInsetCard({
  category,
  title
}: {
  category: ProjectionContentInsetCategory
  title: string
}): ReactElement {
  const insetsByCategory = useProjectionContentInsetsByCategory()
  const insets = insetsByCategory[category]
  const [linked, setLinked] = useState(true)
  const pushTimer = useRef<number | undefined>(undefined)

  const schedulePush = useCallback((next: ProjectionContentInsetsByCategory) => {
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      void pushProjectionContentInsetsToMain(next)
    }, 80)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(pushTimer.current)
    },
    []
  )

  const onInsetChange = useCallback(
    (side: Side, value: number) => {
      if (linked) {
        schedulePush(
          setProjectionContentInsetsForCategory(category, {
            top: value,
            right: value,
            bottom: value,
            left: value
          })
        )
        return
      }
      schedulePush(updateProjectionContentInsetsForCategory(category, { [side]: value }))
    },
    [category, linked, schedulePush]
  )

  return (
    <div className="adw-card settings-bg__controls-card">
      <div className="settings-bg__section-head">
        <h3 className="settings-bg__subtitle">Safe area</h3>
        <p className="adw-caption">Margins around the {title.toLowerCase()} text on the outputs.</p>
      </div>
      <div className="settings-bg__form">
        <div className="adw-list-box">
          <AdwActionRow
            title="Link all sides"
            subtitle="Use one value for top, right, bottom, and left"
            suffix={
              <AdwSwitch
                checked={linked}
                aria-label={`Link all ${title} inset sides`}
                onChange={setLinked}
              />
            }
          />
        </div>
        {SIDES.map(({ key, label }) => (
          <div key={key} className="settings-bg__field">
            <div className="settings-bg__field-row">
              <span className="settings-field__label">{label}</span>
              <span className="adw-caption">{insets[key].toFixed(1)} vmin</span>
            </div>
            <AdwScale
              min={PROJECTION_CONTENT_INSET_MIN}
              max={PROJECTION_CONTENT_INSET_MAX}
              step={0.5}
              value={insets[key]}
              aria-label={`${label} content inset for ${title}`}
              onChange={(value) => onInsetChange(key, value)}
            />
          </div>
        ))}
        <button
          type="button"
          className="adw-button adw-button--flat"
          onClick={() => schedulePush(resetProjectionContentInsetsForCategory(category))}
        >
          Reset safe area
        </button>
      </div>
    </div>
  )
}
