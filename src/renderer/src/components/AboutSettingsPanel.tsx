import type { ReactElement } from 'react'
import logoUrl from '../../../../images/orion-logo.png'
import packageJson from '../../../../package.json'

export function AboutSettingsPanel(): ReactElement {
  return (
    <div className="settings-panel settings-about">
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
