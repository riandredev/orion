import type { ReactElement } from 'react'
import { Icon } from '@iconify/react'
import type { AppIconName } from './icons'
import { AppIcons, ribbonIconSize } from './icons'

type RibbonButtonProps = {
  label: string
  icon: AppIconName
  large?: boolean
  accent?: boolean
  onClick?: () => void
}

export function RibbonButton({
  label,
  icon,
  large = false,
  accent = false,
  onClick
}: RibbonButtonProps): ReactElement {
  const className = [
    'ribbon-btn',
    large ? 'ribbon-btn--large' : '',
    accent ? 'ribbon-btn--suggested' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={className} onClick={onClick} title={label}>
      <Icon
        icon={AppIcons[icon]}
        className="ribbon-btn__icon"
        width={large ? 26 : ribbonIconSize}
        height={large ? 26 : ribbonIconSize}
        aria-hidden="true"
      />
      <span className="ribbon-btn__text">{label}</span>
    </button>
  )
}
