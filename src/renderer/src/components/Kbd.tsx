import { Icon } from '@iconify/react'
import type { ReactElement, ReactNode } from 'react'
import type { AppIconName } from './icons'
import { AppIcons } from './icons'

type KbdProps = {
  children: ReactNode
}

/** Inline keyboard hint — Adwaita-style key cap. */
export function Kbd({ children }: KbdProps): ReactElement {
  return <kbd className="adw-kbd">{children}</kbd>
}

const kbdIconSize = 14

/** Key cap showing a Coolicons glyph (arrow keys, etc.). */
export function KbdIcon({ name }: { name: AppIconName }): ReactElement {
  return (
    <kbd className="adw-kbd adw-kbd--icon">
      <Icon icon={AppIcons[name]} width={kbdIconSize} height={kbdIconSize} aria-hidden />
    </kbd>
  )
}
