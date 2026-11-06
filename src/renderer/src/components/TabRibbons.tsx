import type { ReactElement, ReactNode } from 'react'
import { RibbonButton } from './RibbonButton'

function RibbonGroup({
  label,
  children
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group__tools">{children}</div>
      <div className="ribbon-group__label">{label}</div>
    </div>
  )
}

function CompactRibbon({
  ariaLabel,
  children
}: {
  ariaLabel: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="ribbon ribbon--compact" role="toolbar" aria-label={ariaLabel}>
      {children}
    </div>
  )
}

function OutputGroup(): ReactElement {
  return (
    <RibbonGroup label="Output">
      <RibbonButton icon="expand" label="Send to outputs" accent />
    </RibbonGroup>
  )
}

export function PresentationTabRibbon(): ReactElement {
  return (
    <CompactRibbon ariaLabel="Presentation commands">
      <RibbonGroup label="Deck">
        <span className="order-ribbon__chip order-ribbon__chip--muted adw-caption ribbon-chip-placeholder">
          No deck open
        </span>
      </RibbonGroup>
      <RibbonGroup label="Slides">
        <RibbonButton icon="plus" label="New slide" />
        <RibbonButton icon="listPlus" label="Duplicate" />
        <RibbonButton icon="clear" label="Delete slide" />
      </RibbonGroup>
      <RibbonGroup label="Show">
        <RibbonButton icon="presentation" label="Start show" accent large />
        <RibbonButton icon="square" label="Blank screen" />
      </RibbonGroup>
      <OutputGroup />
    </CompactRibbon>
  )
}

