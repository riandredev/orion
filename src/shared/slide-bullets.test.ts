import { describe, expect, it } from 'vitest'
import { normalizeSlideBullets, pinDefaultTextColor, type BulletHost } from './slide-bullets'

describe('normalizeSlideBullets', () => {
  it('turns Wingdings private-use bullets into a glyph the theme font can draw', () => {
    const shape: BulletHost = {
      type: 'shape',
      textBody: {
        paragraphs: [
          {
            properties: {
              bullet: { type: 'char', char: '\uF0B7', fontFamily: 'Wingdings' }
            },
            runs: [{ properties: { color: { hex: '#151515', alpha: 1 } } }]
          }
        ]
      }
    }
    normalizeSlideBullets([shape])
    const bullet = shape.textBody?.paragraphs[0]?.properties.bullet
    expect(bullet?.char).toBe('•')
    expect(bullet?.fontFamily).toBeUndefined()
    expect(bullet?.color?.hex).toBe('#151515')
  })
})

describe('pinDefaultTextColor', () => {
  it('gives uncolored slide text a dark default without overriding explicit colors', () => {
    const markup = pinDefaultTextColor('<svg xmlns="http://www.w3.org/2000/svg" width="10"></svg>')
    expect(markup).toContain('data-orion-ink')
    expect(markup).toContain('span:not([style*="color"]){color:#151515}')
  })
})
