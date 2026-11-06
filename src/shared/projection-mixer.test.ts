import { describe, expect, it } from 'vitest'
import { ProjectionMixerEngine } from './projection-mixer'

describe('ProjectionMixerEngine (end-to-end layer composition & stop behavior)', () => {
  const sampleImage = {
    type: 'image' as const,
    filePath: 'C:/order-images/welcome/slide1.jpg',
    mediaUrl: 'file:///C:/order-images/welcome/slide1.jpg',
    animation: 'cut' as const,
    durationMs: 0
  }

  const sampleBible = {
    type: 'bible' as const,
    reference: 'Song of Solomon 1:12',
    locationLabel: 'Song of Solomon:1:12',
    translationLabel: 'KJV',
    verses: [{ number: 12, text: 'While the king sat at his table...' }],
    highlightVerse: 12
  }

  it('keeps a live deck slide on its own overlay above order images', () => {
    const mixer = new ProjectionMixerEngine()
    const slide = {
      type: 'deck-slide' as const,
      markup: '<svg></svg>',
      width: 960,
      height: 540,
      transition: 'fade',
      durationMs: 400,
      media: []
    }
    expect(mixer.setLayer('presentation', slide)).toEqual({ base: slide, overlay: null })
    expect(mixer.setLayer('order', sampleImage)).toEqual({ base: sampleImage, overlay: slide })
    expect(mixer.getUiState(true)).toMatchObject({
      orderActive: true,
      presentationActive: true,
      outputsOpen: true
    })
    expect(mixer.clearLayer('order')).toEqual({ base: slide, overlay: null })
  })

  it('projects Order image, overlays Bible verse, stops Bible keeping Order, then stops Order closing all', () => {
    const mixer = new ProjectionMixerEngine()

    // 1. Project Order image
    const stage1 = mixer.setLayer('order', sampleImage)
    expect(stage1).toEqual({
      base: sampleImage,
      overlay: null
    })
    expect(mixer.hasActiveLayers()).toBe(true)
    expect(mixer.getUiState(true)).toMatchObject({
      stack: { base: 'order', overlay: null },
      orderActive: true,
      bibleActive: false,
      outputsOpen: true
    })

    // 2. Project Bible verse -> overlaps on top of Order image (does NOT wipe out Order)
    const stage2 = mixer.setLayer('bible', sampleBible)
    expect(stage2).toEqual({
      base: sampleImage,
      overlay: sampleBible
    })
    expect(mixer.hasActiveLayers()).toBe(true)
    expect(mixer.getUiState(true)).toMatchObject({
      stack: { base: 'order', overlay: 'bible' },
      orderActive: true,
      bibleActive: true,
      outputsOpen: true
    })

    // 3. Stop Bible projection -> removes only Bible overlay; Order image stays live on base!
    const stage3 = mixer.clearLayer('bible')
    expect(stage3).toEqual({
      base: sampleImage,
      overlay: null
    })
    expect(mixer.hasActiveLayers()).toBe(true)
    expect(mixer.getUiState(true)).toMatchObject({
      stack: { base: 'order', overlay: null },
      orderActive: true,
      bibleActive: false,
      outputsOpen: true
    })

    // 4. Stop Order projection -> stack is now empty, outputs close
    const stage4 = mixer.clearLayer('order')
    expect(stage4).toEqual({
      base: null,
      overlay: null
    })
    expect(mixer.hasActiveLayers()).toBe(false)
    expect(mixer.getUiState(false)).toMatchObject({
      stack: { base: null, overlay: null },
      orderActive: false,
      bibleActive: false,
      outputsOpen: false
    })
  })

  it('supports stopping Order while Bible is overlaid (promotes Bible to base)', () => {
    const mixer = new ProjectionMixerEngine()
    mixer.setLayer('order', sampleImage)
    mixer.setLayer('bible', sampleBible)

    const stage = mixer.clearLayer('order')
    expect(stage).toEqual({
      base: sampleBible,
      overlay: null
    })
    expect(mixer.hasActiveLayers()).toBe(true)
    expect(mixer.getUiState(true)).toMatchObject({
      stack: { base: 'bible', overlay: null },
      orderActive: false,
      bibleActive: true,
      outputsOpen: true
    })
  })
})
