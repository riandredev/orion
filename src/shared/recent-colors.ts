export type RecentColorSwatch = {
  color: string
  label: string
}

export function normalizeRecentHex(hex: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1]
    const g = hex[2]
    const b = hex[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return null
}

export function recentColorGroup(swatches: readonly { color: string }[]): string {
  return swatches.map((swatch) => normalizeRecentHex(swatch.color) ?? swatch.color).join('|')
}

export function pushRecentColor(current: readonly string[], hex: string, limit: number): readonly string[] {
  const color = normalizeRecentHex(hex)
  if (!color || limit < 1) return current
  if (current[0] === color) return current
  return [color, ...current.filter((entry) => normalizeRecentHex(entry) !== color)].slice(0, limit)
}

export function mergeRecentSwatches(
  defaults: readonly RecentColorSwatch[],
  recents: readonly string[]
): RecentColorSwatch[] {
  const limit = defaults.length
  if (limit === 0) return []
  const known = new Map(defaults.map((swatch) => [normalizeRecentHex(swatch.color) ?? swatch.color, swatch]))
  const seen = new Set<string>()
  const out: RecentColorSwatch[] = []
  const take = (hex: string): void => {
    const color = normalizeRecentHex(hex)
    if (!color || seen.has(color) || out.length >= limit) return
    seen.add(color)
    const match = known.get(color)
    out.push(match ?? { color, label: color.toUpperCase() })
  }
  for (const color of recents) take(color)
  for (const swatch of defaults) take(swatch.color)
  return out
}
