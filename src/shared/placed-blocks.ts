import {
  BIBLE_ANCHORS,
  clampBlockWidth,
  type BibleAnchor,
  type BibleBlockMargin
} from './bible-block-layout'

export const HYMN_BLOCK_IDS = ['corner', 'number', 'lyrics', 'author'] as const
export const DICTIONARY_BLOCK_IDS = ['strongs', 'lemma', 'details', 'definition'] as const

export const FLOW_ANCHOR = 'flow' as const
export type FlowAnchor = BibleAnchor | typeof FLOW_ANCHOR

const ANCHOR_SET = new Set<string>([...BIBLE_ANCHORS, FLOW_ANCHOR])

export type PlacedBlock = {
  anchor: FlowAnchor
  margin: BibleBlockMargin
  width: number
}

export type PlacedBlockMap<T extends string = string> = Record<T, PlacedBlock>

function clampMargin(raw: unknown): BibleBlockMargin {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const side = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.min(30, Math.max(0, Math.round(n * 10) / 10))
  }
  return {
    top: side(record.top),
    right: side(record.right),
    bottom: side(record.bottom),
    left: side(record.left)
  }
}

export function defaultPlacedBlocks<T extends string>(ids: readonly T[]): PlacedBlockMap<T> {
  const next = {} as PlacedBlockMap<T>
  for (const id of ids) {
    next[id] = {
      anchor: 'flow',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      width: 100
    }
  }
  return next
}

export function clampPlacedBlocks<T extends string>(
  raw: unknown,
  ids: readonly T[]
): PlacedBlockMap<T> {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const next = defaultPlacedBlocks(ids)
  for (const id of ids) {
    const item = record[id]
    const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const anchor = typeof source.anchor === 'string' && ANCHOR_SET.has(source.anchor) ? source.anchor : 'flow'
    next[id] = {
      anchor: anchor as FlowAnchor,
      margin: clampMargin(source.margin),
      width: clampBlockWidth(source.width)
    }
  }
  return next
}

export function placedBlocksCustom<T extends string>(layout: PlacedBlockMap<T>): boolean {
  return Object.values(layout).some((block) => {
    const item = block as PlacedBlock
    return (
      item.anchor !== 'flow' ||
      item.width < 100 ||
      item.margin.top > 0 ||
      item.margin.right > 0 ||
      item.margin.bottom > 0 ||
      item.margin.left > 0
    )
  })
}
