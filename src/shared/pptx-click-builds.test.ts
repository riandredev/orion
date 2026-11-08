import { describe, expect, it } from 'vitest'
import {
  clickStepCount,
  decorateBuildMarkup,
  flyOriginsFromTiming,
  hiddenIdsAtStep,
  holdBlankLines,
  motionsAtStep,
  planClickBuilds,
  type ClickEffect
} from './pptx-click-builds'

function effect(patch: Partial<ClickEffect> & Pick<ClickEffect, 'targetId' | 'trigger' | 'animClass'>): ClickEffect {
  return {
    preset: 'fade',
    duration: 400,
    ...patch
  }
}

describe('planClickBuilds', () => {
  it('keeps an on-click object hidden until the next click, then stays on the slide', () => {
    const plan = planClickBuilds([
      {
        effects: [
          effect({ targetId: '4', trigger: 'onClick', animClass: 'entrance', preset: 'fly-in', direction: 'left' })
        ]
      },
      {
        effects: [effect({ targetId: '9', trigger: 'onClick', animClass: 'entrance' })]
      }
    ])
    expect(clickStepCount(plan)).toBe(3)
    expect(hiddenIdsAtStep(plan, 0).sort()).toEqual(['4', '9'])
    expect(hiddenIdsAtStep(plan, 1)).toEqual(['9'])
    expect(hiddenIdsAtStep(plan, 2)).toEqual([])
    expect(motionsAtStep(plan, 1).map((motion) => motion.targetId)).toEqual(['4'])
  })

  it('plays With Previous and After Previous in the same click as the object they follow', () => {
    const plan = planClickBuilds([
      {
        effects: [
          effect({ targetId: '1', trigger: 'onClick', animClass: 'entrance', duration: 300 }),
          effect({ targetId: '2', trigger: 'withPrevious', animClass: 'entrance', duration: 300 }),
          effect({ targetId: '3', trigger: 'afterPrevious', animClass: 'entrance', duration: 200, delay: 50 })
        ]
      }
    ])
    expect(plan.clicks).toHaveLength(1)
    expect(plan.clicks[0]?.effects.map((item) => [item.targetId, item.startMs])).toEqual([
      ['1', 0],
      ['2', 0],
      ['3', 350]
    ])
    expect(hiddenIdsAtStep(plan, 0).sort()).toEqual(['1', '2', '3'])
    expect(hiddenIdsAtStep(plan, 1)).toEqual([])
  })

  it('plays a leading With Previous when the slide arrives, before any click', () => {
    const plan = planClickBuilds([
      { effects: [effect({ targetId: '1', trigger: 'withPrevious', animClass: 'entrance' })] },
      { effects: [effect({ targetId: '2', trigger: 'onClick', animClass: 'entrance' })] }
    ])
    expect(plan.auto?.effects.map((item) => item.targetId)).toEqual(['1'])
    expect(clickStepCount(plan)).toBe(2)
    expect(hiddenIdsAtStep(plan, 0)).toEqual(['2'])
  })

  it('flies a paragraph in on its own and keeps the blank line between paragraphs', () => {
    const plan = planClickBuilds([
      {
        effects: [
          effect({
            targetId: '3',
            paragraphIndex: 0,
            trigger: 'onClick',
            animClass: 'entrance',
            preset: 'fly-in',
            direction: 'top'
          }),
          effect({
            targetId: '3',
            paragraphIndex: 2,
            trigger: 'onClick',
            animClass: 'entrance',
            preset: 'fly-in',
            direction: 'top'
          })
        ]
      }
    ])
    expect(hiddenIdsAtStep(plan, 0)).toEqual(['3:p0', '3:p2'])
    expect(hiddenIdsAtStep(plan, 1)).toEqual(['3:p2'])
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<g data-pagus-id="2"><foreignObject x="0" y="0" width="10" height="10"><div style="padding:0">x</div></foreignObject></g>',
      '<g data-pagus-id="3" transform="translate(10,20)">',
      '<foreignObject x="0" y="0" width="200" height="80">',
      '<div xmlns="http://www.w3.org/1999/xhtml" style="padding:4px 8px 4px 8px">',
      '<p data-pagus-p-idx="0"><span></span></p>',
      '<p data-pagus-p-idx="1"><span></span></p>',
      '</div></foreignObject></g></svg>'
    ].join('')
    const held = holdBlankLines(svg)
    expect(held).toContain('<span>&nbsp;</span>')
    const next = decorateBuildMarkup(held, motionsAtStep(plan, 1))
    expect(next).toContain('[data-pagus-p-idx="0"]')
    expect(next).toContain('--orion-from-y:-640px')
    expect(next).toContain('y="-680"')
    expect(next).toContain('height="1440"')
  })

  it('reads From Top-Left and From Bottom from the motion PowerPoint stored', () => {
    const fromTopLeft = `
      <p:anim><p:cBhvr><p:tgtEl><p:spTgt spid="3"><p:txEl><p:pRg st="0" end="0"/></p:txEl></p:spTgt></p:tgtEl>
      <p:attrNameLst><p:attrName>ppt_x</p:attrName></p:attrNameLst></p:cBhvr>
      <p:tavLst><p:tav tm="0"><p:val><p:strVal val="0-#ppt_w/2"/></p:val></p:tav></p:tavLst></p:anim>
      <p:anim><p:cBhvr><p:tgtEl><p:spTgt spid="3"><p:txEl><p:pRg st="0" end="0"/></p:txEl></p:spTgt></p:tgtEl>
      <p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr>
      <p:tavLst><p:tav tm="0"><p:val><p:strVal val="0-#ppt_h/2"/></p:val></p:tav></p:tavLst></p:anim>`
    expect(flyOriginsFromTiming(fromTopLeft)).toEqual([
      { targetId: '3', paragraphIndex: 0, direction: 'left-top' }
    ])
    const fromBottom = `
      <p:anim><p:cBhvr><p:tgtEl><p:spTgt spid="3"><p:txEl><p:pRg st="2" end="2"/></p:txEl></p:spTgt></p:tgtEl>
      <p:attrNameLst><p:attrName>ppt_x</p:attrName></p:attrNameLst></p:cBhvr>
      <p:tavLst><p:tav tm="0"><p:val><p:strVal val="#ppt_x"/></p:val></p:tav></p:tavLst></p:anim>
      <p:anim><p:cBhvr><p:tgtEl><p:spTgt spid="3"><p:txEl><p:pRg st="2" end="2"/></p:txEl></p:spTgt></p:tgtEl>
      <p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr>
      <p:tavLst><p:tav tm="0"><p:val><p:strVal val="1+#ppt_h/2"/></p:val></p:tav></p:tavLst></p:anim>`
    expect(flyOriginsFromTiming(fromBottom)).toEqual([
      { targetId: '3', paragraphIndex: 2, direction: 'bottom' }
    ])
    const markup = decorateBuildMarkup('<svg xmlns="http://www.w3.org/2000/svg"></svg>', [
      {
        targetId: '3',
        paragraphIndex: 0,
        preset: 'fly-in',
        direction: 'left-top',
        duration: 500,
        startMs: 0,
        out: false
      }
    ])
    expect(markup).toContain('--orion-from-x:-640px')
    expect(markup).toContain('--orion-from-y:-640px')
  })

  it('embeds the motion in the slide markup', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g data-pagus-id="4"></g></svg>'
    const next = decorateBuildMarkup(svg, [
      { targetId: '4', preset: 'fade', duration: 500, startMs: 0, out: false }
    ])
    expect(next).toContain('orion-build-fade 500ms')
    expect(next).toContain('[data-pagus-id="4"]')
  })
})