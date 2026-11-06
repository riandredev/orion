const SYMBOL_FONTS = /wingding|symbol|webdings/i

const WINGDING_BULLET: Record<number, string> = {
  0xf06c: '•',
  0xf076: '◆',
  0xf0a7: '▪',
  0xf0a8: '▪',
  0xf0b7: '•',
  0xf0d8: '➤',
  0xf0fc: '✓'
}

export type SlideBullet = {
  type: 'char' | 'number' | 'picture'
  char?: string
  fontFamily?: string
  color?: { hex: string; alpha: number }
}

export type BulletParagraph = {
  properties: { bullet?: SlideBullet }
  runs: { properties: { color?: { hex: string; alpha: number } } }[]
}

export type BulletHost = {
  type: string
  textBody?: { paragraphs: BulletParagraph[] }
  children?: BulletHost[]
}

function readableChar(bullet: SlideBullet): void {
  if (bullet.type === 'picture') {
    bullet.type = 'char'
    bullet.char = '•'
    bullet.fontFamily = undefined
    return
  }
  if (bullet.type !== 'char' || !bullet.char) return
  const code = bullet.char.codePointAt(0) ?? 0
  const symbolFont = SYMBOL_FONTS.test(bullet.fontFamily ?? '')
  const privateUse = code >= 0xf000 && code <= 0xf8ff
  if (!symbolFont && !privateUse) return
  bullet.char = WINGDING_BULLET[code] ?? '•'
  bullet.fontFamily = undefined
}

/** Symbol-font bullets paint as blank, and uncolored markers inherit the app's light text. */
export function normalizeSlideBullets(elements: BulletHost[]): void {
  for (const element of elements) {
    if (element.children) normalizeSlideBullets(element.children)
    for (const paragraph of element.textBody?.paragraphs ?? []) {
      const bullet = paragraph.properties.bullet
      if (!bullet) continue
      readableChar(bullet)
      if (!bullet.color) {
        const color = paragraph.runs.find((run) => run.properties.color)?.properties.color
        if (color) bullet.color = color
      }
    }
  }
}

export function pinDefaultTextColor(markup: string): string {
  if (!markup.includes('<svg') || markup.includes('data-orion-ink')) return markup
  return markup.replace(
    /<svg\b([^>]*)>/,
    '<svg data-orion-ink="1"$1><style>foreignObject span:not([style*="color"]){color:#151515}</style>'
  )
}
