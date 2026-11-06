/** Viewport used for projection auto-fit (stage or preview canvas size). */
export type ProjectionFitViewport = {
  width: number
  height: number
}

export function fitBibleVerseText(textEl: HTMLElement, viewport: ProjectionFitViewport): void {
  const body = textEl.parentElement
  if (!body) return
  const maxHeight = body.clientHeight
  const maxWidth = body.clientWidth
  if (maxHeight <= 0 || maxWidth <= 0) return

  textEl.style.fontSize = ''
  textEl.style.width = '100%'
  textEl.style.maxWidth = '100%'

  void viewport
  const configured = parseFloat(window.getComputedStyle(textEl).fontSize)
  const minPx = 18
  let size = Number.isFinite(configured) && configured > 0 ? configured : 64
  textEl.style.fontSize = `${size}px`

  const fits = () =>
    textEl.scrollHeight <= maxHeight + 2 && textEl.scrollWidth <= textEl.clientWidth + 2

  while (size > minPx && !fits()) {
    size -= 2
    textEl.style.fontSize = `${size}px`
  }
}

export function fitHymnTitleHero(heroRoot: HTMLElement, viewport: ProjectionFitViewport): void {
  heroRoot.style.fontSize = ''
  const maxPx = Math.min(viewport.height * 0.17, viewport.width * 0.13)
  const minPx = 40
  let size = maxPx
  heroRoot.style.fontSize = `${size}px`
  const fits = () => heroRoot.scrollHeight <= heroRoot.clientHeight + 2
  while (size > minPx && !fits()) {
    size -= 2
    heroRoot.style.fontSize = `${size}px`
  }
}

export function applyProjectionSlideFits(root: HTMLElement, mode: 'bible' | 'hymns' | 'dictionary'): void {
  const viewport: ProjectionFitViewport = {
    width: root.clientWidth,
    height: root.clientHeight
  }
  if (viewport.width <= 0 || viewport.height <= 0) return

  if (mode === 'bible') {
    for (const el of root.querySelectorAll('.bible-proj__text')) {
      fitBibleVerseText(el as HTMLElement, viewport)
    }
  }

  if (mode === 'hymns') {
    for (const el of root.querySelectorAll('.hymn-proj__title-hero')) {
      fitHymnTitleHero(el as HTMLElement, viewport)
    }
  }
}
