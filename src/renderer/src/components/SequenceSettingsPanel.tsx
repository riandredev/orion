import { useEffect, useState, type ReactElement } from 'react'
import { loadPlaybackSettings, savePlaybackSettings, type PlaybackSettings } from '../lib/playback-settings'
import { loadSequenceBundleContent, saveSequenceBundleContent } from '../lib/sequence-bundle-setting'
import { AdwActionRow } from './AdwActionRow'
import { AdwSwitch } from './AdwSwitch'

export function SequenceSettingsPanel(): ReactElement {
  const [bundleContent, setBundleContent] = useState(loadSequenceBundleContent)
  const [playback, setPlayback] = useState<PlaybackSettings>(loadPlaybackSettings)

  useEffect(() => {
    const onProfile = (): void => {
      setBundleContent(loadSequenceBundleContent())
      setPlayback(loadPlaybackSettings())
    }
    window.addEventListener('orion-profile-applied', onProfile)
    return () => window.removeEventListener('orion-profile-applied', onProfile)
  }, [])

  const setPlaybackField = (patch: Partial<PlaybackSettings>): void => {
    const next = { ...playback, ...patch }
    setPlayback(next)
    savePlaybackSettings(next)
  }

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

      <div className="adw-card settings-panel__card">
        <div className="settings-bg__section-head">
          <h3 className="settings-bg__subtitle">Playback</h3>
          <p className="adw-caption">What starts on its own when you present.</p>
        </div>
        <div className="adw-list-box">
          <AdwActionRow
            title="Autoplay media library videos"
            subtitle="Start the video when you present a file from the media library, including from the sequence."
            suffix={
              <AdwSwitch
                checked={playback.autoplayLibraryMedia}
                aria-label="Autoplay media library videos"
                onChange={(enabled) => setPlaybackField({ autoplayLibraryMedia: enabled })}
              />
            }
          />
          <AdwActionRow
            title="Autoplay presentation videos"
            subtitle="Start a slide video when Next presents that slide."
            suffix={
              <AdwSwitch
                checked={playback.autoplayPresentationMedia}
                aria-label="Autoplay presentation videos"
                onChange={(enabled) => setPlaybackField({ autoplayPresentationMedia: enabled })}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
