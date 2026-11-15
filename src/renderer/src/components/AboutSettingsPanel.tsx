import { useEffect, useState, type ReactElement } from 'react'
import logoUrl from '../../../../images/orion-logo.png'
import packageJson from '../../../../package.json'

type ReleaseLine = 'stable' | 'experimental'

export function AboutSettingsPanel(): ReactElement {
  const [channel, setChannel] = useState<ReleaseLine>('stable')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void window.orion.getUpdateChannel?.().then((value) => {
      if (value === 'stable' || value === 'experimental') setChannel(value)
    })
  }, [])

  async function choose(next: ReleaseLine): Promise<void> {
    if (busy || next === channel) return
    setBusy(true)
    setMessage('')
    const result = await window.orion.switchUpdateChannel(next)
    setBusy(false)
    if (result.ok) return
    if (result.message) setMessage(result.message)
  }

  const onExperimental = channel === 'experimental'

  return (
    <div className="settings-panel settings-about">
      <div className="adw-card settings-about__list settings-about__switch">
        <div className="settings-about__row">
          <span className="settings-about__label">Release line</span>
          <div className="settings-about__choices">
            <button
              type="button"
              className={channel === 'stable' ? 'adw-button adw-button--suggested' : 'adw-button adw-button--flat'}
              aria-pressed={channel === 'stable'}
              disabled={busy}
              onClick={() => void choose('stable')}
            >
              Release
            </button>
            <button
              type="button"
              className={onExperimental ? 'adw-button adw-button--suggested' : 'adw-button adw-button--flat'}
              aria-pressed={onExperimental}
              disabled={busy}
              onClick={() => void choose('experimental')}
            >
              Experimental
            </button>
          </div>
          <p className="adw-caption settings-about__note">
            {busy
              ? 'Downloading. Orion will restart when it is ready.'
              : onExperimental
                ? 'You are on Experimental. Choose Release to download the current release and restart.'
                : 'You are on the release. Choose Experimental for the lighter build. Orion downloads it and restarts.'}
          </p>
          {message ? <p className="adw-caption settings-about__note">{message}</p> : null}
        </div>
      </div>

      <div className="settings-about__hero">
        <img className="settings-about__logo" src={logoUrl} alt="Orion" />
        <p className="settings-about__author">Riandre van der Voorden</p>
        <p className="adw-caption settings-about__lead">
          Open source, under the GNU General Public License.
        </p>
      </div>

      <h3 className="settings-about__heading">Software information</h3>
      <div className="adw-card settings-about__list">
        <div className="settings-about__row">
          <span className="settings-about__label">Version</span>
          <span className="settings-about__value">{packageJson.version}</span>
        </div>
        <div className="settings-about__row">
          <span className="settings-about__label">License</span>
          <span className="settings-about__value">GNU General Public License</span>
        </div>
        <div className="settings-about__row">
          <span className="settings-about__label">Contact</span>
          <a
            className="settings-about__value settings-about__link"
            href="mailto:hello@riandre.com"
            onClick={(event) => {
              event.preventDefault()
              window.open('mailto:hello@riandre.com')
            }}
          >
            hello@riandre.com
          </a>
        </div>
      </div>
    </div>
  )
}
