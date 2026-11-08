export type ArrangementRect = {
  x: number
  y: number
  width: number
  height: number
}

export type ArrangementPoint = {
  x: number
  y: number
}

const ALIGN_PENALTY = 4

function clampPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: ArrangementRect
): ArrangementPoint {
  return {
    x: Math.min(bounds.width - width, Math.max(bounds.x, x)),
    y: Math.min(bounds.height - height, Math.max(bounds.y, y))
  }
}

function overlaps(a: ArrangementRect, b: ArrangementRect): boolean {
  return a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5
}

function slotsAround(other: ArrangementRect, width: number, height: number): ArrangementPoint[] {
  const yAligns = [other.y, other.y + other.height - height]
  const xAligns = [other.x, other.x + other.width - width]
  const slots: ArrangementPoint[] = []
  for (const y of yAligns) {
    slots.push({ x: other.x + other.width, y })
    slots.push({ x: other.x - width, y })
  }
  for (const x of xAligns) {
    slots.push({ x, y: other.y + other.height })
    slots.push({ x, y: other.y - height })
  }
  return slots
}

/**
 * Lock a monitor flush against the others. A lone monitor stays at `home`.
 * When no joined slot fits, it stays where it already was.
 */
export function snapArrangementPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  others: ArrangementRect[],
  home: ArrangementPoint,
  bounds: ArrangementRect,
  stay: ArrangementPoint
): ArrangementPoint {
  if (others.length === 0) return clampPoint(home.x, home.y, width, height, bounds)

  let best: ArrangementPoint | null = null
  let bestScore = Infinity
  for (const other of others) {
    for (const slot of slotsAround(other, width, height)) {
      const clamped = clampPoint(slot.x, slot.y, width, height, bounds)
      if (Math.abs(clamped.x - slot.x) > 0.5 || Math.abs(clamped.y - slot.y) > 0.5) continue
      const rect = { x: clamped.x, y: clamped.y, width, height }
      if (others.some((item) => overlaps(rect, item))) continue
      const dx = clamped.x - x
      const dy = clamped.y - y
      const crossAlign =
        (Math.abs(clamped.y - other.y) < 0.5 ? 0 : ALIGN_PENALTY) +
        (Math.abs(clamped.x - other.x) < 0.5 ? 0 : ALIGN_PENALTY)
      const score = dx * dx + dy * dy + crossAlign
      if (score < bestScore) {
        bestScore = score
        best = clamped
      }
    }
  }
  return best ?? clampPoint(stay.x, stay.y, width, height, bounds)
}
