import type { ReactElement } from 'react'
import { Icon } from '@iconify/react'
import type { AppIconName } from './icons'
import { AppIcons, toolbarIconSize } from './icons'

type AppIconProps = {
  name: AppIconName
  size?: number
  className?: string
}

export function AppIcon({ name, size = toolbarIconSize, className }: AppIconProps): ReactElement {
  return (
    <Icon
      icon={AppIcons[name]}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  )
}
