import { useEffect, useState, type ReactElement } from 'react'
import { loadSequenceBundleContent, saveSequenceBundleContent } from '../lib/sequence-bundle-setting'
import { AdwActionRow } from './AdwActionRow'
import { AdwSwitch } from './AdwSwitch'

export function SequenceSettingsPanel(): ReactElement {
  const [bundleContent, setBundleContent] = useState(loadSequenceBundleContent)

  useEffect(() => {
    const onProfile = (): void => setBundleContent(loadSequenceBundleContent())
    window.addEventListener('orion-profile-applied', onProfile)
    return () => window.removeEventListener('orion-profile-applied', onProfile)
  }, [])

  return (
    <div className="settings-panel">
      <h2 className="settings-panel__title">Sequence</h2>
      <p className="adw-caption">
        The service rundown in the sidebar: order images, hymns, Bible verses, presentations, and
        dictionary entries.
      </p>

      <div className="adw-card settings-panel__card">
        <div className="settings-bg__section-head">
          <h3 className="settings-bg__subtitle">Sequence files</h3>
          <p className="adw-caption">
            Export writes an <code>.orionseq</code> file. Import restores that rundown on this
            computer.
          </p>
        </div>
        <div className="adw-list-box">
          <AdwActionRow
            title="Export sequence files with content inside"
            subtitle="Include service-order images and presentations, including their videos. Hymn, Bible, and dictionary text is always stored in the file."
            suffix={
              <AdwSwitch
                checked={bundleContent}
                aria-label="Export sequence files with content inside"
                onChange={(enabled) => {
                  setBundleContent(enabled)
                  saveSequenceBundleContent(enabled)
                }}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
