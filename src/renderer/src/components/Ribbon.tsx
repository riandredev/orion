import type { ReactElement } from 'react'
import type { WorkspaceTab } from '../navigation'
import { OrderBlockRibbon, type OrderBlockRibbonProps } from './OrderBlockRibbon'
import { BibleTabRibbon, type BibleTabRibbonProps } from './BibleTabRibbon'
import { DictionaryTabRibbon, type DictionaryTabRibbonProps } from './DictionaryTabRibbon'
import { HymnsTabRibbon, type HymnsTabRibbonProps } from './HymnsTabRibbon'
import { MediaTabRibbon } from './MediaTabRibbon'
import {
  PresentationTabRibbon,
  type PresentationTabRibbonProps
} from './PresentationTabRibbon'
import { WebTabRibbon, type WebTabRibbonProps } from './WebTabRibbon'

type RibbonProps = {
  activeTab: WorkspaceTab
  orderBlock?: OrderBlockRibbonProps
  webBlock?: WebTabRibbonProps
  bibleBlock?: BibleTabRibbonProps
  dictionaryBlock?: DictionaryTabRibbonProps
  hymnsBlock?: HymnsTabRibbonProps
  presentationBlock?: PresentationTabRibbonProps
}

export function Ribbon({
  activeTab,
  orderBlock,
  webBlock,
  bibleBlock,
  dictionaryBlock,
  hymnsBlock,
  presentationBlock
}: RibbonProps): ReactElement {
  if (activeTab === 'order' && orderBlock) {
    return <OrderBlockRibbon {...orderBlock} />
  }
  if (activeTab === 'hymns' && hymnsBlock) return <HymnsTabRibbon {...hymnsBlock} />
  if (activeTab === 'bible' && bibleBlock) return <BibleTabRibbon {...bibleBlock} />
  if (activeTab === 'presentation' && presentationBlock) {
    return <PresentationTabRibbon {...presentationBlock} />
  }
  if (activeTab === 'media') return <MediaTabRibbon />
  if (activeTab === 'web' && webBlock) return <WebTabRibbon {...webBlock} />
  if (activeTab === 'dictionary' && dictionaryBlock) return <DictionaryTabRibbon {...dictionaryBlock} />
  return <div className="ribbon ribbon--compact" role="toolbar" aria-hidden="true" />
}
