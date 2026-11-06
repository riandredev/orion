import type { ReactElement } from 'react'
import { workspaceTabs, type WorkspaceTab } from '../navigation'
import { AppIcon } from './AppIcon'
import { AdwTooltip } from './AdwTooltip'
import { Ribbon } from './Ribbon'
import type { OrderBlockRibbonProps } from './OrderBlockRibbon'
import type { BibleTabRibbonProps } from './BibleTabRibbon'
import type { DictionaryTabRibbonProps } from './DictionaryTabRibbon'
import type { HymnsTabRibbonProps } from './HymnsTabRibbon'
import type { PresentationTabRibbonProps } from './PresentationTabRibbon'
import type { WebTabRibbonProps } from './WebTabRibbon'

type TopBarProps = {
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  onOpenSettings: () => void
  orderBlock?: OrderBlockRibbonProps
  webBlock?: WebTabRibbonProps
  bibleBlock?: BibleTabRibbonProps
  dictionaryBlock?: DictionaryTabRibbonProps
  hymnsBlock?: HymnsTabRibbonProps
  presentationBlock?: PresentationTabRibbonProps
}

export function TopBar({
  activeTab,
  onTabChange,
  onOpenSettings,
  orderBlock,
  webBlock,
  bibleBlock,
  dictionaryBlock,
  hymnsBlock,
  presentationBlock
}: TopBarProps): ReactElement {
  return (
    <header className="top-chrome">
      <div className="top-chrome__tab-row" role="tablist" aria-label="Workspace">
        <div className="top-chrome__tabs">
          {workspaceTabs.map((tab) => {
            const selected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={selected ? 'top-tab top-tab--active' : 'top-tab'}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="top-chrome__spacer" />
        <AdwTooltip text="Settings">
          <button
            type="button"
            className="adw-button adw-button--flat top-chrome__settings-btn"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <AppIcon name="settings" size={16} />
          </button>
        </AdwTooltip>
      </div>
      <Ribbon
        activeTab={activeTab}
        orderBlock={orderBlock}
        webBlock={webBlock}
        bibleBlock={bibleBlock}
        dictionaryBlock={dictionaryBlock}
        hymnsBlock={hymnsBlock}
        presentationBlock={presentationBlock}
      />
    </header>
  )
}
