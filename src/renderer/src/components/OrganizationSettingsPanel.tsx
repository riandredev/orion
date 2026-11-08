import { useCallback, useEffect, useState, type ReactElement } from 'react'
import {
  createProfile,
  deleteProfile,
  duplicateActiveProfile,
  exportActiveProfileToFile,
  importProfileFromFileDialog,
  persistActiveProfileSnapshot,
  switchActiveProfile,
  updateActiveProfile,
  useActiveProfile,
  useProfileRegistry
} from '../lib/orion-profiles'
import type { OrionProfileMeta } from '../../../shared/orion-profile'
import { AdwActionRow } from './AdwActionRow'
import { AdwSelect } from './AdwSelect'
import { AdwSwitch } from './AdwSwitch'

export function OrganizationSettingsPanel(): ReactElement {
  const registry = useProfileRegistry()
  const active = useActiveProfile()
  const [orgName, setOrgName] = useState(active.organizationName)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('New profile')

  useEffect(() => {
    setOrgName(active.organizationName)
  }, [active.id, active.organizationName])

  const profileOptions = registry.profiles.map((p: OrionProfileMeta) => ({
    value: p.id,
    label: p.id === registry.activeProfileId ? `${p.name} (active)` : p.name
  }))

  const flash = useCallback((message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(null), 3200)
  }, [])

  const onOrgNameBlur = (): void => {
    if (orgName.trim() === active.organizationName) return
    updateActiveProfile({ organizationName: orgName.trim() })
    persistActiveProfileSnapshot()
  }

  const onSwitchProfile = (profileId: string): void => {
    if (profileId === registry.activeProfileId) return
    const next = switchActiveProfile(profileId)
    setOrgName(next.organizationName)
    flash('Profile switched — settings loaded.')
  }

  return (
    <div className="settings-panel settings-org">
      <h2 className="settings-panel__title">Organization</h2>
      <p className="adw-caption">
        Organization details, named profiles, and portable settings packages for this
        workstation.
      </p>

      {status ? <p className="settings-org__status adw-caption">{status}</p> : null}

      <div className="settings-bg__grid">
        <div className="adw-card settings-bg__controls-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">Organization</h3>
            <p className="adw-caption">Shown in exports and helps identify this profile pack.</p>
          </div>
          <div className="settings-bg__form">
            <div className="settings-bg__field">
              <label className="settings-field__label" htmlFor="org-name">
                Organization name
              </label>
              <input
                id="org-name"
                type="text"
                className="adw-input"
                value={orgName}
                placeholder="e.g. Grace Community Church"
                onChange={(e) => setOrgName(e.target.value)}
                onBlur={onOrgNameBlur}
              />
            </div>
          </div>
        </div>

        <div className="adw-card settings-bg__controls-card">
          <div className="settings-bg__section-head">
            <h3 className="settings-bg__subtitle">Preferences</h3>
            <p className="adw-caption">Stored in the active profile (included in export).</p>
          </div>
          <div className="adw-list-box">
            <AdwActionRow
              title="Open maximized"
              subtitle="Fill the screen when Orion launches"
              suffix={
                <AdwSwitch
                  checked={active.preferences.openMaximized}
                  aria-label="Open maximized on launch"
                  onChange={(openMaximized) => {
                    updateActiveProfile({ preferences: { openMaximized } })
                    persistActiveProfileSnapshot()
                  }}
                />
              }
            />
          </div>
        </div>
      </div>

      <div className="adw-card settings-panel__card settings-org__profiles-card">
        <div className="settings-bg__section-head">
          <h3 className="settings-bg__subtitle">Profiles</h3>
          <p className="adw-caption">
            Each profile keeps displays, backgrounds, type, safe areas, Bible and hymn options,
            the service sequence, library layout, and the preferences below. Changes save into
            the active profile immediately.
          </p>
        </div>

        <div className="settings-org__profile-toolbar">
          <div className="settings-org__profile-picker">
            <span className="settings-field__label">Active profile</span>
            <AdwSelect
              value={registry.activeProfileId}
              options={profileOptions}
              aria-label="Active profile"
              onChange={onSwitchProfile}
            />
          </div>
          <div className="settings-org__profile-actions">
            <button
              type="button"
              className="adw-button adw-button--flat"
              onClick={() => {
                setNewName('New profile')
                setCreating(true)
              }}
            >
              New
            </button>
            <button
              type="button"
              className="adw-button adw-button--flat"
              onClick={() => {
                const created = duplicateActiveProfile()
                setOrgName(created.organizationName)
                setCreating(false)
                flash(`Switched to “${created.name}”.`)
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="adw-button adw-button--flat"
              disabled={registry.profiles.length <= 1}
              onClick={() => {
                if (registry.profiles.length <= 1) return
                const ok = window.confirm(
                  `Delete profile “${active.name}”? This cannot be undone.`
                )
                if (!ok) return
                deleteProfile(active.id)
                flash('Profile deleted.')
              }}
            >
              Delete
            </button>
          </div>
        </div>

        {creating ? (
          <form
            className="settings-org__profile-create"
            onSubmit={(event) => {
              event.preventDefault()
              const name = newName.trim()
              if (!name) return
              const created = createProfile(name, { blank: true })
              setOrgName(created.organizationName)
              setCreating(false)
              flash(`Created “${created.name}” and switched to it.`)
            }}
          >
            <label className="settings-field__label" htmlFor="new-profile-name">
              New profile name
            </label>
            <div className="settings-org__profile-create-row">
              <input
                id="new-profile-name"
                className="adw-input"
                value={newName}
                autoFocus
                onChange={(event) => setNewName(event.target.value)}
              />
              <button type="submit" className="adw-button adw-button--suggested">
                Create
              </button>
              <button type="button" className="adw-button adw-button--flat" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="settings-org__io-row">
          <button
            type="button"
            className="adw-button adw-button--suggested settings-org__io-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void exportActiveProfileToFile(false)
                .then((path) => {
                  if (path) flash(`Exported settings to ${path}`)
                  else flash('Export cancelled.')
                })
                .catch(() => flash('Could not export the profile.'))
                .finally(() => setBusy(false))
            }}
          >
            Export settings…
          </button>
          <button
            type="button"
            className="adw-button settings-org__io-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void exportActiveProfileToFile(true)
                .then((path) => {
                  if (path) flash(`Exported settings and content to ${path}`)
                  else flash('Export cancelled.')
                })
                .catch(() => flash('Could not export the profile.'))
                .finally(() => setBusy(false))
            }}
          >
            Export settings and content…
          </button>
          <button
            type="button"
            className="adw-button settings-org__io-btn"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void importProfileFromFileDialog(true)
                .then((profile) => {
                  if (profile) {
                    setOrgName(profile.organizationName)
                    flash(`Imported “${profile.name}” and set active.`)
                  } else {
                    flash('Import cancelled or invalid file.')
                  }
                })
                .catch(() => flash('Could not import the profile.'))
                .finally(() => setBusy(false))
            }}
          >
            Import profile…
          </button>
        </div>
        <p className="adw-caption settings-org__io-hint">
          Settings files use <code>.orionprofile</code>. Settings and content uses{' '}
          <code>.orionpack</code> and includes hymnals, Bibles, presentations, media, service-order
          images, and backgrounds.
        </p>
      </div>
    </div>
  )
}
