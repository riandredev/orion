import type { ReactElement, ReactNode } from 'react'
import type { AdwSelectOption } from './AdwSelect'

function Icon({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {children}
    </svg>
  )
}

export function TransitionIcon({ name }: { name: string }): ReactElement | null {
  switch (name) {
    case 'crossfade':
      return (
        <Icon>
          <rect x="1.5" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="6.5" y="5" width="8" height="8" rx="1" fill="currentColor" />
        </Icon>
      )
    case 'fade':
      return (
        <Icon>
          <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" opacity="0.28" />
          <rect x="3" y="3" width="10" height="5" rx="1" fill="currentColor" />
        </Icon>
      )
    case 'cut':
      return (
        <Icon>
          <rect x="2.5" y="3" width="11" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 3.2v9.6" stroke="currentColor" strokeWidth="1.4" />
        </Icon>
      )
    case 'wipe':
      return (
        <Icon>
          <rect x="2" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="2.6" y="3.6" width="5.2" height="8.8" fill="currentColor" />
        </Icon>
      )
    case 'push':
      return (
        <Icon>
          <rect x="1" y="4" width="7" height="8" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="8" y="4" width="7" height="8" rx="1" fill="currentColor" />
        </Icon>
      )
    case 'cover':
      return (
        <Icon>
          <rect x="1.5" y="5" width="8" height="8" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="6.5" y="3" width="8" height="8" rx="1" fill="currentColor" />
        </Icon>
      )
    case 'uncover':
      return (
        <Icon>
          <rect x="6.5" y="5" width="8" height="8" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="1.5" y="3" width="8" height="8" rx="1" fill="currentColor" />
        </Icon>
      )
    case 'split':
      return (
        <Icon>
          <rect x="2" y="3" width="4" height="10" rx="1" fill="currentColor" />
          <rect x="10" y="3" width="4" height="10" rx="1" fill="currentColor" />
        </Icon>
      )
    case 'zoom':
      return (
        <Icon>
          <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
          <rect x="5" y="5" width="6" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </Icon>
      )
    case 'iris':
      return (
        <Icon>
          <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </Icon>
      )
    case 'bars':
      return (
        <Icon>
          <rect x="2" y="3" width="2.2" height="10" rx="0.4" fill="currentColor" />
          <rect x="6.9" y="3" width="2.2" height="10" rx="0.4" fill="currentColor" />
          <rect x="11.8" y="3" width="2.2" height="10" rx="0.4" fill="currentColor" />
        </Icon>
      )
    case 'pixels':
      return (
        <Icon>
          <rect x="2" y="2" width="3" height="3" fill="currentColor" />
          <rect x="6.5" y="2" width="3" height="3" fill="currentColor" />
          <rect x="11" y="2" width="3" height="3" fill="currentColor" />
          <rect x="2" y="6.5" width="3" height="3" fill="currentColor" />
          <rect x="6.5" y="6.5" width="3" height="3" fill="currentColor" />
          <rect x="11" y="6.5" width="3" height="3" fill="currentColor" />
          <rect x="2" y="11" width="3" height="3" fill="currentColor" />
          <rect x="6.5" y="11" width="3" height="3" fill="currentColor" />
          <rect x="11" y="11" width="3" height="3" fill="currentColor" />
        </Icon>
      )
    default:
      return null
  }
}

export function withTransitionIcons<T extends string>(
  options: readonly { value: T; label: string }[]
): AdwSelectOption<T>[] {
  return options.map((option) => {
    const icon = <TransitionIcon name={option.value} />
    return icon ? { ...option, icon } : option
  })
}
