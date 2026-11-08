export function cssDimOverlay(color: string, opacityPercent: number): string {
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'
  const n = Number.parseInt(hex.slice(1), 16)
  const alpha = Math.min(95, Math.max(0, opacityPercent)) / 100
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
