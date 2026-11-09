import type { ReactElement, ReactNode } from 'react'

type AdwActionRowProps = {
  title: string
  subtitle?: ReactNode
  prefix?: ReactNode
  suffix: ReactNode
  className?: string
}

/** Gtk AdwActionRow-style row (title + trailing control). */
export function AdwActionRow({ title, subtitle, prefix, suffix, className = '' }: AdwActionRowProps): ReactElement {
  return (
    <div className={`adw-action-row ${className}`.trim()}>
      {prefix ? <div className="adw-action-row__prefix">{prefix}</div> : null}
      <div className="adw-action-row__content">
        <span className="adw-action-row__title">{title}</span>
        {subtitle ? <span className="adw-action-row__subtitle adw-caption">{subtitle}</span> : null}
      </div>
      <div className="adw-action-row__suffix">{suffix}</div>
    </div>
  )
}
