/** PowerPoint main-sequence click model: On Click, With Previous, After Previous. */

export type ClickAnimClass = 'entrance' | 'exit' | 'emphasis' | 'path'

export type ClickTrigger = 'onClick' | 'withPrevious' | 'afterPrevious'

export type ClickEffect = {
  targetId: string
  paragraphIndex?: number
  preset: string
  animClass: ClickAnimClass
  trigger: ClickTrigger
  duration: number
  delay?: number
  direction?: string
}

export type TimedClickEffect = ClickEffect & { startMs: number }

export type ClickBuild = {
  effects: TimedClickEffect[]
}

export type ClickPlan = {
  /** Plays when the slide arrives, before any click. */
  auto: ClickBuild | null
  /** Each entry is one press of Next. */
  clicks: ClickBuild[]
}

function effectKey(effect: ClickEffect): string {
  return effect.paragraphIndex != null ? `${effect.targetId}:p${effect.paragraphIndex}` : effect.targetId
}

function timeGroup(effects: ClickEffect[]): ClickBuild {
  let prevStart = 0
  let prevDur = 0
  const timed = effects.map((effect, index) => {
    const extra = effect.delay ?? 0
    let startMs = extra
    if (index > 0 && effect.trigger === 'afterPrevious') startMs = prevStart + prevDur + extra
    else if (index > 0 && effect.trigger === 'withPrevious') startMs = prevStart + extra
    prevStart = startMs
    prevDur = Math.max(0, effect.duration)
    return { ...effect, startMs }
  })
  return { effects: timed }
}

/** Groups a flat animation list the way PowerPoint's main sequence does. */
export function planClickBuilds(steps: { effects: ClickEffect[] }[]): ClickPlan {
  const groups: ClickEffect[][] = []
  for (const step of steps) {
    for (const effect of step.effects) {
      if (groups.length === 0 || effect.trigger === 'onClick') groups.push([effect])
      else groups[groups.length - 1]!.push(effect)
    }
  }
  const timed = groups.map(timeGroup)
  if (timed.length === 0) return { auto: null, clicks: [] }
  const first = timed[0]!
  if (first.effects[0]?.trigger === 'onClick') return { auto: null, clicks: timed }
  return { auto: first, clicks: timed.slice(1) }
}

export function clickStepCount(plan: ClickPlan): number {
  return plan.clicks.length + 1
}

function played(plan: ClickPlan, step: number): ClickBuild[] {
  const groups: ClickBuild[] = []
  if (plan.auto) groups.push(plan.auto)
  for (let index = 0; index < step && index < plan.clicks.length; index += 1) {
    const group = plan.clicks[index]
    if (group) groups.push(group)
  }
  return groups
}

function currentGroup(plan: ClickPlan, step: number): ClickBuild | null {
  if (step <= 0) return plan.auto
  return plan.clicks[step - 1] ?? null
}

/** Shape and paragraph ids that must stay out of the picture at this click. */
export function hiddenIdsAtStep(plan: ClickPlan, step: number): string[] {
  const hidden = new Set<string>()
  const all = [plan.auto, ...plan.clicks].flatMap((group) => group?.effects ?? [])
  for (const effect of all) {
    if (effect.animClass === 'entrance') hidden.add(effectKey(effect))
  }
  for (const group of played(plan, step)) {
    for (const effect of group.effects) {
      if (effect.animClass === 'entrance') hidden.delete(effectKey(effect))
    }
  }
  const showing = currentGroup(plan, step)
  for (const group of played(plan, step)) {
    if (group === showing) continue
    for (const effect of group.effects) {
      if (effect.animClass === 'exit') hidden.add(effectKey(effect))
    }
  }
  return [...hidden]
}

export type BuildMotion = {
  targetId: string
  paragraphIndex?: number
  preset: string
  direction?: string
  duration: number
  startMs: number
  out: boolean
}

/** Whole-shape motions that should play on this click. Paragraph builds stay a cut. */
export function motionsAtStep(plan: ClickPlan, step: number): BuildMotion[] {
  const group = currentGroup(plan, step)
  if (!group) return []
  return group.effects.flatMap((effect) => {
    if (effect.animClass !== 'entrance' && effect.animClass !== 'exit') return []
    return [
      {
        targetId: effect.targetId,
        paragraphIndex: effect.paragraphIndex,
        preset: effect.preset,
        direction: effect.direction,
        duration: Math.max(1, effect.duration),
        startMs: effect.startMs,
        out: effect.animClass === 'exit'
      }
    ]
  })
}

/** A blank paragraph is the gap PowerPoint keeps between paragraphs that build separately. */
export function holdBlankLines(svg: string): string {
  return svg.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/g, (full, attrs: string, inner: string) => {
    const text = inner
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, '')
    if (text) return full
    if (inner.includes('<span')) return full.replace(/<span\b([^>]*)>\s*<\/span>/, '<span$1>&nbsp;</span>')
    return `<p${attrs}>&nbsp;</p>`
  })
}

const BUILD_CSS = `
@keyframes orion-build-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes orion-build-appear { from { opacity: 0 } to { opacity: 1 } }
@keyframes orion-build-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes orion-build-zoom { from { opacity: 0; scale: 0.2 } to { opacity: 1; scale: 1 } }
@keyframes orion-build-fly { from { opacity: 0; translate: var(--orion-from-x) var(--orion-from-y) } to { opacity: 1; translate: 0 0 } }
@keyframes orion-build-wipe-left { from { opacity: 1; clip-path: inset(0 100% 0 0) } to { opacity: 1; clip-path: inset(0) } }
@keyframes orion-build-wipe-right { from { opacity: 1; clip-path: inset(0 0 0 100%) } to { opacity: 1; clip-path: inset(0) } }
@keyframes orion-build-wipe-top { from { opacity: 1; clip-path: inset(0 0 100% 0) } to { opacity: 1; clip-path: inset(0) } }
@keyframes orion-build-wipe-bottom { from { opacity: 1; clip-path: inset(100% 0 0 0) } to { opacity: 1; clip-path: inset(0) } }
`.replace(/\n/g, '')

function directionName(motion: BuildMotion, prefix: string): string {
  if (motion.direction === 'left') return `${prefix}-left`
  if (motion.direction === 'right') return `${prefix}-right`
  if (motion.direction === 'top') return `${prefix}-top`
  if (motion.direction === 'bottom') return `${prefix}-bottom`
  return 'orion-build-fade'
}

function isFly(motion: BuildMotion): boolean {
  return !motion.out && (motion.preset === 'fly-in' || motion.preset === 'float-in' || motion.preset === 'peek-in')
}

function flyShift(direction: string | undefined): { x: string; y: string } {
  const d = direction ?? ''
  const travel = '640px'
  const fromLeft = d.includes('left')
  const fromRight = !fromLeft && d.includes('right')
  const fromBottom = d.includes('bottom')
  const fromTop = !fromBottom && d.includes('top')
  const x = fromLeft ? `-${travel}` : fromRight ? travel : '0px'
  let y = fromTop ? `-${travel}` : fromBottom ? travel : '0px'
  if (x === '0px' && y === '0px') y = '72px'
  return { x, y }
}

export type FlyOrigin = {
  targetId: string
  paragraphIndex?: number
  /** Side the object comes from, such as `left-top` or `bottom`. */
  direction: string
}

/** PowerPoint writes the real fly as a start position on the slide, not in the direction name. */
export function flyOriginsFromTiming(xml: string): FlyOrigin[] {
  const anims = xml.match(/<p:anim\b[\s\S]*?<\/p:anim>/g) ?? []
  const groups: { targetId: string; paragraphIndex?: number; x?: string; y?: string }[] = []
  const open = new Map<string, (typeof groups)[number]>()
  for (const anim of anims) {
    const axis = anim.match(/<p:attrName>(ppt_[xy])<\/p:attrName>/)?.[1]
    if (axis !== 'ppt_x' && axis !== 'ppt_y') continue
    const targetId = anim.match(/\bspid="(\d+)"/)?.[1]
    const start = anim.match(/tm="0"[\s\S]*?val="([^"]+)"/)?.[1]
    if (!targetId || !start) continue
    const paragraph = anim.match(/<p:pRg\b[^>]*\bst="(\d+)"/)
    const paragraphIndex = paragraph ? Number(paragraph[1]) : undefined
    const id = `${targetId}:${paragraphIndex ?? ''}`
    let group = open.get(id)
    const field = axis === 'ppt_x' ? 'x' : 'y'
    if (!group || group[field]) {
      group = { targetId, paragraphIndex }
      groups.push(group)
      open.set(id, group)
    }
    group[field] = start
  }
  return groups.flatMap((group) => {
    const direction = originFromStart(group.x ?? '#ppt_x', group.y ?? '#ppt_y')
    return direction ? [{ targetId: group.targetId, paragraphIndex: group.paragraphIndex, direction }] : []
  })
}

function originFromStart(startX: string, startY: string): string | undefined {
  const horizontal = /(?:^|[^\d])0\s*-/.test(startX) || /#ppt_x\s*-/.test(startX)
    ? 'left'
    : /(?:^|[^\d])1\s*\+/.test(startX) || /#ppt_x\s*\+/.test(startX)
      ? 'right'
      : ''
  const vertical = /(?:^|[^\d])0\s*-/.test(startY) || /#ppt_y\s*-/.test(startY)
    ? 'top'
    : /(?:^|[^\d])1\s*\+/.test(startY) || /#ppt_y\s*\+/.test(startY)
      ? 'bottom'
      : ''
  if (horizontal && vertical) return `${horizontal}-${vertical}`
  return horizontal || vertical || undefined
}

function motionName(motion: BuildMotion): string {
  if (motion.out) return 'orion-build-out'
  if (motion.preset === 'appear') return 'orion-build-appear'
  if (motion.preset === 'zoom') return 'orion-build-zoom'
  if (motion.preset === 'wipe' || motion.preset === 'split') return directionName(motion, 'orion-build-wipe')
  if (isFly(motion)) return 'orion-build-fly'
  return 'orion-build-fade'
}

function motionSelector(motion: BuildMotion): string {
  const id = `[data-pagus-id="${cssEscape(motion.targetId)}"]`
  if (motion.paragraphIndex == null) return id
  return `${id} [data-pagus-p-idx="${motion.paragraphIndex}"]`
}

const FLY_ROOM = 680

function padStyle(style: string): string {
  const match = style.match(/padding:([^;]+)/)
  if (!match) return `${style};padding:${FLY_ROOM}px`
  const parts = match[1].trim().split(/\s+/).map((part) => Number.parseFloat(part) || 0)
  let top = 0
  let right = 0
  let bottom = 0
  let left = 0
  if (parts.length <= 1) top = right = bottom = left = parts[0] ?? 0
  else if (parts.length === 2) {
    top = bottom = parts[0] ?? 0
    right = left = parts[1] ?? 0
  } else if (parts.length === 3) {
    top = parts[0] ?? 0
    right = left = parts[1] ?? 0
    bottom = parts[2] ?? 0
  } else {
    top = parts[0] ?? 0
    right = parts[1] ?? 0
    bottom = parts[2] ?? 0
    left = parts[3] ?? 0
  }
  return style.replace(
    /padding:[^;]+/,
    `padding:${top + FLY_ROOM}px ${right + FLY_ROOM}px ${bottom + FLY_ROOM}px ${left + FLY_ROOM}px`
  )
}

/** Gives a paragraph room to travel inside the text box. The box otherwise clips the fly. */
function roomForParagraphFly(svg: string, motions: BuildMotion[]): string {
  const ids = [...new Set(motions.filter((motion) => motion.paragraphIndex != null && isFly(motion)).map((motion) => motion.targetId))]
  let next = svg
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(
      `(<g\\b[^>]*\\bdata-pagus-id="${escaped}"[^>]*>(?:(?!data-pagus-id=)[\\s\\S])*?<foreignObject\\s)([^>]*?)(>)((?:(?!data-pagus-id=)[\\s\\S])*?<div\\b[^>]*style=")([^"]*)"`
    )
    next = next.replace(pattern, (_full, start: string, attrs: string, end: string, divStart: string, style: string) => {
      const read = (name: string): number => {
        const found = attrs.match(new RegExp(`\\b${name}="(-?[\\d.]+)"`))
        return found ? Number(found[1]) : 0
      }
      const x = read('x') - FLY_ROOM
      const y = read('y') - FLY_ROOM
      const width = read('width') + FLY_ROOM * 2
      const height = read('height') + FLY_ROOM * 2
      let geometry = attrs
      const write = (name: string, value: number): void => {
        if (new RegExp(`\\b${name}="`).test(geometry)) {
          geometry = geometry.replace(new RegExp(`\\b${name}="-?[\\d.]+"`), `${name}="${value}"`)
        } else {
          geometry = `${name}="${value}" ${geometry}`
        }
      }
      write('x', x)
      write('y', y)
      write('width', width)
      write('height', height)
      return `${start}${geometry}${end}${divStart}${padStyle(style)}"`
    })
  }
  return next
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Adds the entrance or exit motion inside the slide SVG so the projector plays it too. */
export function decorateBuildMarkup(svg: string, motions: BuildMotion[]): string {
  if (motions.length === 0 || !svg.includes('<svg')) return svg
  const rules = motions
    .map((motion) => {
      const name = motionName(motion)
      const duration = name === 'orion-build-appear' ? 1 : motion.duration
      const shift = name === 'orion-build-fly' ? flyShift(motion.direction) : null
      const from = shift ? `--orion-from-x:${shift.x};--orion-from-y:${shift.y};` : ''
      return `${motionSelector(motion)}{${from}animation:${name} ${duration}ms ease ${motion.startMs}ms both}`
    })
    .join('')
  const styled = svg.replace(/<svg\b([^>]*)>/, `<svg$1><style>${BUILD_CSS}${rules}</style>`)
  return roomForParagraphFly(styled, motions)
}
