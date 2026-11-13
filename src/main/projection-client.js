/** Client script for projection output windows (loaded from projection.html). */
const stage = document.getElementById('stage')
if (!stage) throw new Error('Missing projection stage')

const baseLayer = document.createElement('div')
baseLayer.id = 'base-layer'
const overlayLayer = document.createElement('div')
overlayLayer.id = 'overlay-layer'
overlayLayer.setAttribute('hidden', '')
stage.replaceChildren(baseLayer, overlayLayer)

let overlayClearTimer = null
let overlayLeaving = false

/** @type {{ bible: { top: number; right: number; bottom: number; left: number }; hymns: { top: number; right: number; bottom: number; left: number }; dictionary: { top: number; right: number; bottom: number; left: number } }} */
let contentInsetsByCategory = {
  bible: { top: 3.5, right: 4.5, bottom: 4, left: 4.5 },
  hymns: { top: 3.5, right: 4.5, bottom: 4, left: 4.5 },
  dictionary: { top: 6, right: 7, bottom: 6, left: 7 }
}

/** @param {HTMLElement} el @param {{ top: number; right: number; bottom: number; left: number }} insets */
function applyInsetsToElement(el, insets) {
  el.style.setProperty('--orion-content-inset-top', `${insets.top}vmin`)
  el.style.setProperty('--orion-content-inset-right', `${insets.right}vmin`)
  el.style.setProperty('--orion-content-inset-bottom', `${insets.bottom}vmin`)
  el.style.setProperty('--orion-content-inset-left', `${insets.left}vmin`)
}

/** @param {'bible' | 'hymns' | 'dictionary'} category */
function refreshLiveContentInsets(category) {
  const insets = contentInsetsByCategory[category]
  if (!insets) return
  const selector =
    category === 'bible'
      ? '.bible-proj'
      : category === 'hymns'
        ? '.hymn-proj'
        : '.dictionary-proj'
  for (const el of document.querySelectorAll(selector)) {
    applyInsetsToElement(/** @type {HTMLElement} */ (el), insets)
    if (category === 'bible') {
      const text = el.querySelector('.bible-proj__text')
      if (text) {
        requestAnimationFrame(() => {
          fitBibleVerse(/** @type {HTMLElement} */ (text))
        })
      }
    }
    if (category === 'hymns') {
      const hero = el.querySelector('.hymn-proj__title-hero')
      if (hero) {
        requestAnimationFrame(() => {
          fitHymnTitleSlide(/** @type {HTMLElement} */ (hero))
        })
      }
    }
  }
}

/** @returns {{ width: number; height: number }} */
function projectionStageViewport() {
  const stage = document.getElementById('stage')
  const width = stage?.clientWidth || window.innerWidth
  const height = stage?.clientHeight || window.innerHeight
  return { width, height }
}

/** @param {HTMLElement} heroRoot */
function fitHymnTitleSlide(heroRoot) {
  heroRoot.style.fontSize = ''
  const { width, height } = projectionStageViewport()
  const maxPx = Math.min(height * 0.17, width * 0.13)
  const minPx = 40
  let size = maxPx
  heroRoot.style.fontSize = `${size}px`
  const fits = () => heroRoot.scrollHeight <= heroRoot.clientHeight + 2
  while (size > minPx && !fits()) {
    size -= 2
    heroRoot.style.fontSize = `${size}px`
  }
}

/** @param {HTMLElement} wrap */
function appendHymnAuthor(wrap, author) {
  const text = typeof author === 'string' ? author.trim() : ''
  if (!text) return
  const el = document.createElement('p')
  el.className = 'hymn-proj__author'
  el.textContent = text
  wrap.appendChild(el)
  return el
}

/** @param {string | undefined} reference */
function bibleLocationFallback(reference) {
  const trimmed = String(reference ?? '').trim()
  const match = trimmed.match(/^(.+?)\s+(\d+:\d+(?:[–-]\d+)?|\d+:\d+|\d+)$/)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  return trimmed
}

/** Highlight Latin-script wording so the English gloss stands out from the lexicon notes. */
function appendEnglishDefinition(el, text) {
  const pattern = /[A-Za-z][A-Za-z'’\-]*(?:[ \t]+[A-Za-z][A-Za-z'’\-]*)*/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) el.append(document.createTextNode(text.slice(last, index)))
    const span = document.createElement('span')
    span.className = 'dictionary-proj__definition-en'
    span.textContent = match[0]
    el.append(span)
    last = index + match[0].length
  }
  if (last < text.length) el.append(document.createTextNode(text.slice(last)))
}

/** @param {HTMLElement} textEl */
function fitBibleVerse(textEl) {
  const body = textEl.parentElement
  if (!body) return
  const maxHeight = body.clientHeight
  const maxWidth = body.clientWidth
  if (maxHeight <= 0 || maxWidth <= 0) return

  textEl.style.fontSize = ''
  textEl.style.width = '100%'
  textEl.style.maxWidth = '100%'

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

let pendingSettleMs = 0
let settleToken = 0
let settleTimer = 0
let settleDue = 0

function schedulePreviewSettle(ms) {
  if (window.__orionStillCapture) {
    // A throttled offscreen window can make the next animation frame wait
    // about a second. A short timer still lets the new pixels land.
    window.setTimeout(() => {
      window.orionProjection?.notifySettled?.()
    }, 32)
    return
  }
  const wait = ms > 0 ? ms + 80 : 48
  const due = Date.now() + wait
  if (ms <= 0 && settleTimer && due < settleDue) return
  if (settleTimer) window.clearTimeout(settleTimer)
  const token = ++settleToken
  settleDue = due
  settleTimer = window.setTimeout(() => {
    settleTimer = 0
    if (token !== settleToken) return
    requestAnimationFrame(() => {
      if (token !== settleToken) return
      window.orionProjection?.notifySettled?.()
    })
  }, wait)
}

let deckAudio = false
/** Keep in sync with OUTPUT_MEDIA_VOLUME in src/shared/output-audio.ts */
const OUTPUT_MEDIA_VOLUME = 0.4

function applyDeckAudioFlag() {
  for (const el of document.querySelectorAll('[data-orion-media], [data-orion-library-media]')) {
    const shouldMute = !deckAudio
    if (el.muted !== shouldMute) el.muted = shouldMute
    if (shouldMute && el.volume !== 0) el.volume = 0
    if (!shouldMute && el.volume === 0) el.volume = OUTPUT_MEDIA_VOLUME
  }
}

function silenceMedia(node) {
  for (const el of node.querySelectorAll('video, audio')) {
    el.muted = true
    el.volume = 0
    el.pause()
  }
}

/** @param {boolean} enabled */
function setDeckAudio(enabled) {
  deckAudio = !!enabled
  applyDeckAudioFlag()
}

/** @type {{ action: string; index: number; time: number; epoch: number }[]} */
let deckMediaCommands = []
let deckMediaEpoch = -1
/** @type {{ action: string; time: number; epoch: number } | null} */
let libraryMediaCommand = null
let libraryMediaEpoch = -1

/**
 * @param {HTMLMediaElement} el
 * @param {{ action?: string; time?: number }} command
 */
function nudgeOutputMedia(el, command) {
  const time = Number(command.time)
  if (command.action === 'seek' || command.action === 'pause') {
    if (Number.isFinite(time) && Math.abs(time - (el.currentTime || 0)) > 0.05) {
      try {
        el.currentTime = time
      } catch {
        /* not seekable yet */
      }
    }
    el.playbackRate = 1
    if (command.action === 'pause') el.pause()
    else if (el.paused) void el.play().catch(() => {})
    return
  }
  const drift = time - (el.currentTime || 0)
  if (Number.isFinite(drift)) {
    if (Math.abs(drift) > 0.3) {
      try {
        el.currentTime = time
      } catch {
        /* not seekable yet */
      }
      el.playbackRate = 1
    } else if (drift > 0.06) {
      el.playbackRate = 1.06
    } else if (drift < -0.06) {
      el.playbackRate = 0.96
    } else {
      el.playbackRate = 1
    }
  }
  if (command.action === 'pause') {
    el.playbackRate = 1
    el.pause()
  } else if (command.action === 'play' && el.paused) {
    void el.play().catch(() => {})
  }
}

/**
 * @param {{ action?: string; index?: number; time?: number; epoch?: number }} command
 */
function applyDeckMedia(command) {
  if (!command || typeof command !== 'object') return
  const epoch = typeof command.epoch === 'number' ? command.epoch : 0
  if (epoch < deckMediaEpoch) return
  deckMediaEpoch = epoch
  const index = command.index
  if (typeof index !== 'number' || index < 0 || index > 16) return
  deckMediaCommands[index] = { action: String(command.action), index, time: Number(command.time) || 0, epoch }
  const nodes = document.querySelectorAll('[data-orion-media]')
  const el = nodes[index]
  if (el instanceof HTMLMediaElement) nudgeOutputMedia(el, command)
}

/**
 * @param {{ action?: string; time?: number; epoch?: number }} command
 */
function applyLibraryMedia(command) {
  if (!command || typeof command !== 'object') return
  const epoch = typeof command.epoch === 'number' ? command.epoch : 0
  if (epoch < libraryMediaEpoch) return
  libraryMediaEpoch = epoch
  libraryMediaCommand = {
    action: String(command.action || 'pause'),
    time: Number(command.time) || 0,
    epoch
  }
  const el = document.querySelector('[data-orion-library-media]')
  if (el instanceof HTMLMediaElement) nudgeOutputMedia(el, libraryMediaCommand)
}

function applyStoredLibraryClock(el) {
  const command = libraryMediaCommand
  if (!command) return
  const apply = () => nudgeOutputMedia(el, command)
  el.addEventListener('loadedmetadata', apply)
  el.addEventListener('canplay', apply)
  apply()
}

window.__orionSetDeckAudio = setDeckAudio
window.__orionDeckMedia = applyDeckMedia
window.__orionLibraryMedia = applyLibraryMedia

const imageMotionTimers = new WeakMap()

/**
 * @param {HTMLElement} target
 * @param {{ mediaUrl?: string; animation?: string; durationMs?: number }} data
 */
/**
 * @param {HTMLElement} layer
 * @param {{ backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} data
 */
function paintBackdrop(layer, data) {
  layer.style.backgroundImage = ''
  layer.style.backgroundColor = data.backgroundColor || '#000000'
  const url = typeof data.backgroundMediaUrl === 'string' ? data.backgroundMediaUrl : ''
  let photo = layer.querySelector(':scope > img.orion-layer-bg')
  let veil = layer.querySelector(':scope > .orion-layer-dim')
  if (!url) {
    photo?.remove()
    veil?.remove()
    return
  }
  if (!(photo instanceof HTMLImageElement)) {
    photo = document.createElement('img')
    photo.className = 'orion-layer-bg'
    photo.alt = ''
    layer.insertBefore(photo, layer.firstChild)
  }
  if (photo.getAttribute('src') !== url) photo.src = url
  photo.style.objectFit = data.backgroundFit === 'contain' ? 'contain' : 'cover'
  const dim =
    typeof data.backgroundDimOpacity === 'number'
      ? Math.min(95, Math.max(0, data.backgroundDimOpacity)) / 100
      : 0.55
  if (!veil) {
    veil = document.createElement('div')
    veil.className = 'orion-layer-dim'
    photo.after(veil)
  }
  veil.style.background = dimOverlayColor(data.backgroundDimColor, dim)
}

function dimOverlayColor(color, alpha) {
  const hex = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const LYRIC_MOTIONS = ['fade', 'push']

function hymnSignature(data) {
  return [
    data.number ?? '',
    data.slideKind || 'lyrics',
    data.stanzaKind || '',
    data.verse ?? '',
    data.versePart ?? '',
    data.title ?? '',
    (data.lines || []).join('\n'),
    data.author || '',
    data.blockLayout ? JSON.stringify(data.blockLayout) : ''
  ].join('\u001f')
}

function hymnMotionOf(data) {
  if (window.__orionStillCapture) return { animation: 'none', durationMs: 0 }
  const animation = LYRIC_MOTIONS.includes(data.animation) ? data.animation : 'none'
  const durationMs = Math.min(5000, Math.max(0, Math.round(Number(data.durationMs) || 0)))
  if (animation === 'none' || durationMs <= 0) return { animation: 'none', durationMs: 0 }
  return { animation, durationMs }
}

function pixelHash(x, y, seed) {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1) ^ Math.imul(seed + 1, 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function pixelGrid(width, height) {
  const cell = Math.max(8, Math.round(Math.min(width, height) / 68))
  return {
    cols: Math.max(2, Math.ceil(width / cell)),
    rows: Math.max(2, Math.ceil(height / cell))
  }
}

/** Blocks of the next slide, in the 0–1 box of that slide. */
function pixelRevealPath(cols, rows, progress, seed) {
  let d = ''
  const w = 1 / cols + 0.001
  const h = 1 / rows + 0.001
  for (let row = 0; row < rows; row += 1) {
    const y = row / rows
    for (let col = 0; col < cols; col += 1) {
      if (progress < pixelHash(col, row, seed)) continue
      d += `M${col / cols} ${y}h${w}v${h}h${-w}z`
    }
  }
  return d
}

const pixelRuns = new WeakMap()

function stopPixelRun(host) {
  const stop = host ? pixelRuns.get(host) : null
  if (stop) stop()
}

/**
 * @param {HTMLElement | null} host
 * @param {HTMLElement} previous
 * @param {HTMLElement} incoming
 * @param {number} durationMs
 * @param {() => void} done
 */
function runPixelCover(host, previous, incoming, durationMs, done) {
  if (!host) {
    done()
    return
  }
  stopPixelRun(host)
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  const clip = document.createElementNS(svgNS, 'clipPath')
  const clipId = `orion-pix-${Math.random().toString(36).slice(2)}`
  clip.id = clipId
  clip.setAttribute('clipPathUnits', 'objectBoundingBox')
  const path = document.createElementNS(svgNS, 'path')
  clip.appendChild(path)
  svg.appendChild(clip)
  host.appendChild(svg)
  incoming.style.zIndex = '2'
  previous.style.zIndex = '1'
  incoming.style.clipPath = `url(#${clipId})`
  const seed = Math.floor(Math.random() * 65536)
  const start = performance.now()
  let raf = 0
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    incoming.style.clipPath = ''
    svg.remove()
    pixelRuns.delete(host)
  }
  pixelRuns.set(host, stop)
  const tick = (now) => {
    if (stopped) return
    const rect = incoming.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const { cols, rows } = pixelGrid(width, height)
    const progress = Math.min(1, (now - start) / Math.max(1, durationMs))
    path.setAttribute('d', pixelRevealPath(cols, rows, progress, seed))
    if (progress < 1) {
      raf = requestAnimationFrame(tick)
      return
    }
    stop()
    if (previous.isConnected) previous.remove()
    incoming.style.zIndex = ''
    done()
  }
  raf = requestAnimationFrame(tick)
}

function clearSlideMotion(node) {
  node.style.animation = ''
  node.style.opacity = ''
  node.style.transform = ''
  node.style.clipPath = ''
  node.style.zIndex = ''
  clearRevealMask(node)
}

/**
 * @param {HTMLElement} node
 * @param {'bars' | 'pixels'} kind
 */
function applyRevealMask(node, kind) {
  const mask =
    kind === 'bars'
      ? 'repeating-linear-gradient(to right, #000 0 var(--blind), transparent var(--blind) 8.333%)'
      : 'none'
  node.style.maskImage = mask
  node.style.webkitMaskImage = mask
  node.style.maskRepeat = 'no-repeat'
  node.style.webkitMaskRepeat = 'no-repeat'
  node.style.maskSize = '100% 100%'
  node.style.webkitMaskSize = '100% 100%'
}

/** @param {HTMLElement} node */
function clearRevealMask(node) {
  node.style.maskImage = ''
  node.style.webkitMaskImage = ''
  node.style.maskRepeat = ''
  node.style.webkitMaskRepeat = ''
  node.style.maskSize = ''
  node.style.webkitMaskSize = ''
  node.style.maskComposite = ''
  node.style.webkitMaskComposite = ''
}

/**
 * @param {HTMLElement} previous
 * @param {HTMLElement | null} incoming
 * @param {string} animation
 * @param {number} durationMs
 */
function animateHymnSwap(previous, incoming, animation, durationMs) {
  const host = previous.parentElement
  const pending = imageMotionTimers.get(host || previous)
  if (pending) window.clearTimeout(pending)
  stopPixelRun(host)
  pendingSettleMs = Math.max(pendingSettleMs, durationMs)

  const finish = (ms) => {
    const timer = window.setTimeout(() => {
      if (previous.isConnected) previous.remove()
      if (incoming) clearSlideMotion(incoming)
      schedulePreviewSettle(0)
    }, ms + 40)
    if (host) imageMotionTimers.set(host, timer)
  }

  if (!incoming) {
    previous.style.animation = `orion-order-fade-out ${durationMs}ms ease forwards`
    finish(durationMs)
    return
  }

  incoming.style.zIndex = animation === 'uncover' ? '1' : '2'
  previous.style.zIndex = animation === 'uncover' ? '2' : '1'

  if (animation === 'crossfade') {
    incoming.style.opacity = '0'
    incoming.style.animation = `orion-order-fade-in ${durationMs}ms ease forwards`
    finish(durationMs)
    return
  }

  if (animation === 'fade') {
    const half = Math.max(1, Math.round(durationMs / 2))
    incoming.style.opacity = '0'
    previous.style.animation = `orion-order-fade-out ${half}ms ease forwards`
    const timer = window.setTimeout(() => {
      if (previous.isConnected) previous.remove()
      incoming.style.animation = `orion-order-fade-in ${half}ms ease forwards`
      const done = window.setTimeout(() => {
        clearSlideMotion(incoming)
        schedulePreviewSettle(0)
      }, half + 40)
      if (host) imageMotionTimers.set(host, done)
    }, half)
    if (host) imageMotionTimers.set(host, timer)
    pendingSettleMs = Math.max(pendingSettleMs, durationMs)
    return
  }

  if (animation === 'wipe') {
    incoming.style.animation = `orion-order-wipe ${durationMs}ms ease forwards`
  } else if (animation === 'split') {
    incoming.style.animation = `orion-order-split ${durationMs}ms ease forwards`
  } else if (animation === 'push') {
    incoming.style.animation = `orion-order-push-in ${durationMs}ms ease forwards`
    previous.style.animation = `orion-order-push-out ${durationMs}ms ease forwards`
  } else if (animation === 'cover') {
    incoming.style.animation = `orion-order-push-in ${durationMs}ms ease forwards`
  } else if (animation === 'uncover') {
    previous.style.animation = `orion-order-push-out ${durationMs}ms ease forwards`
  } else if (animation === 'zoom') {
    incoming.style.animation = `orion-order-zoom ${durationMs}ms ease forwards`
  } else if (animation === 'iris') {
    incoming.style.animation = `orion-order-iris ${durationMs}ms ease forwards`
  } else if (animation === 'bars') {
    incoming.style.animation = `orion-order-bars ${durationMs}ms linear forwards`
    applyRevealMask(incoming, 'bars')
  } else if (animation === 'pixels') {
    runPixelCover(host, previous, incoming, durationMs, () => {
      clearSlideMotion(incoming)
      schedulePreviewSettle(0)
    })
    return
  }
  finish(durationMs)
}

/**
 * @param {HTMLElement} target
 * @param {{ number?: number; title?: string; author?: string; slideKind?: string; stanzaKind?: string; verse?: number; versePart?: number; versePartCount?: number; lines?: string[]; animation?: string; durationMs?: number; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} data
 */
function renderHymnPayload(target, data) {
  const sig = hymnSignature(data)
  if (target.dataset.hymnSlide === sig) {
    paintBackdrop(target, data)
    return
  }
  delete target.dataset.bibleSlide
  const motion = hymnMotionOf(data)
  const previous = target.querySelector(':scope > .hymn-proj')
  const animate = previous instanceof HTMLElement && motion.animation !== 'none'
  target.dataset.hymnSlide = sig

  const mount = () => {
    const slideKind = data.slideKind || 'lyrics'
    if (slideKind === 'end') return null
    const wrap = document.createElement('div')
    wrap.className = slideKind === 'title' ? 'hymn-proj hymn-proj--title' : 'hymn-proj'
    wrap.dataset.slide = sig
    applyInsetsToElement(wrap, contentInsetsByCategory.hymns)

    if (slideKind === 'title') {
      const hero = document.createElement('div')
      hero.className = 'hymn-proj__title-hero'
      const numEl = document.createElement('p')
      numEl.className = 'hymn-proj__title-number'
      numEl.textContent = data.number != null ? String(data.number) : ''
      const titleEl = document.createElement('p')
      titleEl.className = 'hymn-proj__title-name'
      titleEl.textContent = data.title ?? ''
      hero.appendChild(numEl)
      hero.appendChild(titleEl)
      wrap.appendChild(hero)
      const titleAuthor = appendHymnAuthor(wrap, data.author)
      applyPlacedBlocks(
        wrap,
        [
          { id: 'number', el: numEl },
          { id: 'lyrics', el: titleEl },
          ...(titleAuthor ? [{ id: 'author', el: titleAuthor }] : [])
        ],
        data.blockLayout
      )
      if (animate && motion.animation === 'uncover') target.insertBefore(wrap, previous)
      else target.appendChild(wrap)
      fitHymnTitleSlide(hero)
      return wrap
    }

    const top = document.createElement('div')
    top.className = 'hymn-proj__top'
    const corner = document.createElement('span')
    corner.className = 'hymn-proj__corner'
    const kind = data.stanzaKind || 'verse'
    if (kind === 'refrain' || kind === 'chorus') {
      const part = data.versePart
      const count = data.versePartCount
      const name = kind === 'chorus' ? 'Chorus' : 'Refrain'
      corner.textContent =
        typeof part === 'number' && typeof count === 'number' && count > 1 && part > 0
          ? `${name} 1 - ${part}`
          : kind === 'refrain'
            ? 'Refrain'
            : kind
    } else if (kind === 'bridge' || kind === 'intro') {
      corner.textContent = kind
    } else if (data.verse != null && data.verse > 0) {
      const part = data.versePart
      const count = data.versePartCount
      corner.textContent =
        typeof part === 'number' && typeof count === 'number' && count > 1 && part > 0
          ? `${data.verse} - ${part}`
          : String(data.verse)
    }
    const heading = document.createElement('p')
    heading.className = 'hymn-proj__heading'
    heading.textContent = data.number != null ? String(data.number) : ''
    top.appendChild(corner)
    top.appendChild(heading)
    wrap.appendChild(top)
    const body = document.createElement('div')
    body.className = 'hymn-proj__lines'
    for (const line of data.lines ?? []) {
      const p = document.createElement('p')
      p.className = 'hymn-proj__line'
      p.textContent = line
      body.appendChild(p)
    }
    wrap.appendChild(body)
    const authorEl = appendHymnAuthor(wrap, data.author)
    applyPlacedBlocks(wrap, [
      { id: 'corner', el: corner },
      { id: 'number', el: heading },
      { id: 'lyrics', el: body },
      ...(authorEl ? [{ id: 'author', el: authorEl }] : [])
    ], data.blockLayout)
    if (animate && motion.animation === 'uncover') target.insertBefore(wrap, previous)
    else target.appendChild(wrap)
    return wrap
  }

  if (!animate) {
    silenceMedia(target)
    target.replaceChildren()
    paintBackdrop(target, data)
    mount()
    return
  }

  silenceMedia(target)
  for (const child of [...target.children]) {
    if (
      child !== previous &&
      !child.classList.contains('orion-layer-bg') &&
      !child.classList.contains('orion-layer-dim')
    ) {
      child.remove()
    }
  }
  paintBackdrop(target, data)
  const incoming = mount()
  animateHymnSwap(previous, incoming, motion.animation, motion.durationMs)
}

function bibleSignature(data) {
  const verse = (data.verses ?? [])[0]
  const layout = data.blockLayout || {}
  return [
    data.reference ?? '',
    data.highlightVerse ?? '',
    verse?.number ?? '',
    verse?.text ?? '',
    layout.reference || 'top',
    layout.translation || 'top',
    layout.verse || 'center',
    marginSignature(layout.margin),
    layout.width ? [layout.width.reference, layout.width.translation, layout.width.verse].join(',') : ''
  ].join('\u001f')
}

function marginSignature(margin) {
  const side = (block) => {
    const value = margin?.[block] || {}
    return [value.top || 0, value.right || 0, value.bottom || 0, value.left || 0].join(',')
  }
  return [side('reference'), side('translation'), side('verse')].join(';')
}

function applyBlockWidth(element, width) {
  const n = Number(width)
  if (!Number.isFinite(n) || n >= 100) return
  element.style.width = `${n}%`
  element.style.maxWidth = `${n}%`
}

function applyPlacedBlocks(wrap, entries, layout) {
  let placed = false
  for (const entry of entries) {
    const spec = layout && layout[entry.id]
    if (!spec) continue
    setBlockMargin(entry.el, spec.margin)
    applyBlockWidth(entry.el, spec.width)
    if (spec.anchor && spec.anchor !== 'flow') {
      entry.el.classList.add('proj-block-anchor', `bible-anchor-${spec.anchor}`)
      placed = true
    }
  }
  if (placed) wrap.classList.add('proj-place')
}

function setBlockMargin(element, margin) {
  const value = margin || {}
  element.style.setProperty('--block-margin-top', `${Number(value.top) || 0}vmin`)
  element.style.setProperty('--block-margin-right', `${Number(value.right) || 0}vmin`)
  element.style.setProperty('--block-margin-bottom', `${Number(value.bottom) || 0}vmin`)
  element.style.setProperty('--block-margin-left', `${Number(value.left) || 0}vmin`)
}

function applyBibleBlockLayout(wrap, top, location, translation, body, layout) {
  const margin = layout?.margin || {}
  setBlockMargin(location, margin.reference)
  setBlockMargin(translation, margin.translation)
  setBlockMargin(body, margin.verse)
  const widths = layout?.width || {}
  applyBlockWidth(location, widths.reference)
  applyBlockWidth(translation, widths.translation)
  applyBlockWidth(body, widths.verse)
  const reference = layout?.reference || 'top'
  const version = layout?.translation || 'top'
  const verse = layout?.verse || 'center'
  if (reference === 'top' && version === 'top' && verse === 'center') return
  wrap.classList.add('bible-proj--anchored')
  top.classList.add('bible-proj__pair', `bible-anchor-${reference}`)
  setBlockMargin(top, margin.reference)
  setBlockMargin(location, {})
  location.style.width = ''
  location.style.maxWidth = ''
  applyBlockWidth(top, widths.reference)
  const split = version !== reference
  if (split) {
    wrap.classList.add('bible-proj--split-heading')
    translation.classList.add(`bible-anchor-${version}`)
    wrap.appendChild(translation)
  }
  body.classList.add(`bible-anchor-${verse}`)
}

/**
 * @param {HTMLElement} target
 * @param {{ reference?: string; locationLabel?: string; translationLabel?: string; verses?: { number: number; text: string }[]; highlightVerse?: number; animation?: string; durationMs?: number; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} data
 */
function renderBiblePayload(target, data) {
  const sig = bibleSignature(data)
  if (target.dataset.bibleSlide === sig) {
    paintBackdrop(target, data)
    return
  }
  delete target.dataset.hymnSlide
  const motion = hymnMotionOf(data)
  const previous = target.querySelector(':scope > .bible-proj')
  const animate = previous instanceof HTMLElement && motion.animation !== 'none'
  target.dataset.bibleSlide = sig

  const mount = () => {
    const verses = data.verses ?? []
    const active = verses.find((v) => v.number === data.highlightVerse) ?? verses[0] ?? null
    if (!active) return null
    const wrap = document.createElement('div')
    wrap.className = 'bible-proj'
    applyInsetsToElement(wrap, contentInsetsByCategory.bible)
    const top = document.createElement('div')
    top.className = 'bible-proj__top'
    const location = document.createElement('p')
    location.className = 'bible-proj__location'
    location.textContent =
      (typeof data.locationLabel === 'string' && data.locationLabel.trim()) ||
      bibleLocationFallback(data.reference)
    const translation = document.createElement('p')
    translation.className = 'bible-proj__translation'
    translation.textContent =
      (typeof data.translationLabel === 'string' && data.translationLabel.trim()) || 'Bible'
    top.appendChild(location)
    top.appendChild(translation)
    wrap.appendChild(top)
    const body = document.createElement('div')
    body.className = 'bible-proj__body'
    const text = document.createElement('p')
    text.className = 'bible-proj__text'
    const num = document.createElement('span')
    num.className = 'bible-proj__verse-num'
    num.textContent = String(active.number)
    const words = document.createElement('span')
    words.className = 'bible-proj__verse-words'
    words.textContent = active.text
    text.append(num, document.createTextNode(' '), words)
    body.appendChild(text)
    wrap.appendChild(body)
    applyBibleBlockLayout(wrap, top, location, translation, body, data.blockLayout)
    target.appendChild(wrap)
    requestAnimationFrame(() => {
      fitBibleVerse(text)
    })
    return wrap
  }

  if (!animate) {
    silenceMedia(target)
    target.replaceChildren()
    paintBackdrop(target, data)
    mount()
    return
  }

  silenceMedia(target)
  for (const child of [...target.children]) {
    if (
      child !== previous &&
      !child.classList.contains('orion-layer-bg') &&
      !child.classList.contains('orion-layer-dim')
    ) {
      child.remove()
    }
  }
  paintBackdrop(target, data)
  const incoming = mount()
  animateHymnSwap(previous, incoming, motion.animation, motion.durationMs)
}

function renderOrderImage(target, data) {
  if (target === baseLayer) {
    baseLayer.style.backgroundColor = '#000000'
    baseLayer.style.backgroundImage = ''
  }
  const mediaUrl = typeof data.mediaUrl === 'string' ? data.mediaUrl : ''
  if (!mediaUrl) {
    target.replaceChildren()
    return
  }
  const slides = /** @type {HTMLImageElement[]} */ ([...target.querySelectorAll(':scope > img.orion-order-slide')])
  const showing = slides[slides.length - 1]
  if (showing && showing.getAttribute('src') === mediaUrl) return

  const named = ['crossfade', 'fade', 'wipe', 'push', 'cover', 'uncover', 'split', 'zoom', 'iris', 'bars', 'pixels']
  const animation = window.__orionStillCapture
    ? 'cut'
    : named.includes(data.animation)
      ? data.animation
      : 'cut'
  const durationMs = Math.min(5000, Math.max(0, Math.round(Number(data.durationMs) || 0)))
  const img = document.createElement('img')
  img.className = 'orion-order-slide'
  img.alt = ''
  img.src = mediaUrl

  const previous = showing && showing.getAttribute('src') !== mediaUrl ? showing : null
  const pending = imageMotionTimers.get(target)
  if (pending) window.clearTimeout(pending)
  stopPixelRun(target)

  const clearMotion = (node) => {
    node.style.animation = ''
    node.style.opacity = ''
    node.style.transform = ''
    node.style.clipPath = ''
    clearRevealMask(node)
  }

  if (!previous || durationMs <= 0 || animation === 'cut') {
    target.replaceChildren(img)
    return
  }

  for (const child of [...target.children]) {
    if (child !== previous) child.remove()
  }
  if (animation === 'uncover') target.insertBefore(img, previous)
  else target.appendChild(img)
  pendingSettleMs = Math.max(pendingSettleMs, durationMs)

  const settleAfter = (ms) => {
    const timer = window.setTimeout(() => {
      if (previous.isConnected) previous.remove()
      clearMotion(img)
      schedulePreviewSettle(0)
    }, ms + 40)
    imageMotionTimers.set(target, timer)
  }

  if (animation === 'crossfade') {
    img.style.opacity = '0'
    img.style.animation = `orion-order-fade-in ${durationMs}ms ease forwards`
    settleAfter(durationMs)
    return
  }

  if (animation === 'fade') {
    const half = Math.max(1, Math.round(durationMs / 2))
    img.style.opacity = '0'
    previous.style.animation = `orion-order-fade-out ${half}ms ease forwards`
    const timer = window.setTimeout(() => {
      if (previous.isConnected) previous.remove()
      img.style.animation = `orion-order-fade-in ${half}ms ease forwards`
      const done = window.setTimeout(() => {
        clearMotion(img)
        schedulePreviewSettle(0)
      }, half + 40)
      imageMotionTimers.set(target, done)
    }, half)
    imageMotionTimers.set(target, timer)
    return
  }

  if (animation === 'wipe') {
    img.style.animation = `orion-order-wipe ${durationMs}ms ease forwards`
  } else if (animation === 'split') {
    img.style.animation = `orion-order-split ${durationMs}ms ease forwards`
  } else if (animation === 'push') {
    img.style.animation = `orion-order-push-in ${durationMs}ms ease forwards`
    previous.style.animation = `orion-order-push-out ${durationMs}ms ease forwards`
  } else if (animation === 'cover') {
    img.style.animation = `orion-order-push-in ${durationMs}ms ease forwards`
  } else if (animation === 'uncover') {
    previous.style.animation = `orion-order-push-out ${durationMs}ms ease forwards`
  } else if (animation === 'zoom') {
    img.style.animation = `orion-order-zoom ${durationMs}ms ease forwards`
  } else if (animation === 'iris') {
    img.style.animation = `orion-order-iris ${durationMs}ms ease forwards`
  } else if (animation === 'bars') {
    img.style.animation = `orion-order-bars ${durationMs}ms linear forwards`
    applyRevealMask(img, 'bars')
  } else if (animation === 'pixels') {
    runPixelCover(target, previous, img, durationMs, () => {
      clearMotion(img)
      schedulePreviewSettle(0)
    })
    return
  }
  settleAfter(durationMs)
}

function installDeckFonts(css) {
  if (typeof css !== 'string' || css.length === 0) return
  let style = document.getElementById('orion-deck-fonts')
  if (!style) {
    style = document.createElement('style')
    style.id = 'orion-deck-fonts'
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}

function deckSlideSignature(data) {
  const markup = typeof data.markup === 'string' ? data.markup : ''
  let hash = markup.length >>> 0
  const step = Math.max(1, Math.floor(markup.length / 48))
  for (let index = 0; index < markup.length; index += step) {
    hash = (Math.imul(hash, 33) + markup.charCodeAt(index)) >>> 0
  }
  const media = Array.isArray(data.media) ? data.media.length : 0
  return `${data.transition || ''}|${data.durationMs || 0}|${media}|${hash}`
}

/** @param {unknown} payload */
function renderPayload(target, payload) {
  if (!payload || typeof payload !== 'object') {
    delete target.dataset.deckSlide
    target.replaceChildren()
    return
  }
  const p = /** @type {{ type?: string }} */ (payload)
  if (p.type !== 'deck-slide') delete target.dataset.deckSlide

  if (p.type === 'image') {
    renderOrderImage(target, /** @type {{ mediaUrl?: string; animation?: string; durationMs?: number }} */ (payload))
    return
  }

  if (p.type === 'media') {
    const data = /** @type {{ mediaUrl?: string; kind?: string; name?: string; autoplay?: boolean }} */ (payload)
    const mediaUrl = typeof data.mediaUrl === 'string' ? data.mediaUrl : ''
    const existing = target.querySelector('[data-orion-library-media]')
    if (existing instanceof HTMLMediaElement && existing.getAttribute('src') === mediaUrl) return
    silenceMedia(target)
    target.replaceChildren()
    if (!mediaUrl) return
    const kind = data.kind === 'audio' ? 'audio' : 'video'
    const autoplay = data.autoplay === true
    const el = document.createElement(kind)
    el.dataset.orionLibraryMedia = '1'
    el.src = mediaUrl
    el.autoplay = autoplay
    el.controls = false
    el.playsInline = true
    el.muted = !deckAudio
    el.volume = deckAudio ? OUTPUT_MEDIA_VOLUME : 0
    el.addEventListener('canplay', () => applyDeckAudioFlag())
    el.addEventListener('volumechange', () => {
      const shouldMute = !deckAudio
      if (el.muted !== shouldMute) el.muted = shouldMute
      if (shouldMute && el.volume !== 0) el.volume = 0
    })
    if (kind === 'video') {
      el.style.position = 'absolute'
      el.style.inset = '0'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.objectFit = 'contain'
      el.style.background = '#000'
    }
    target.appendChild(el)
    if (autoplay) {
      const start = () => {
        if (!libraryMediaCommand) void el.play().catch(() => {})
      }
      el.addEventListener('canplay', start, { once: true })
      start()
    }
    applyStoredLibraryClock(el)
    if (kind === 'audio') {
      const label = document.createElement('p')
      label.textContent = typeof data.name === 'string' && data.name.trim() ? data.name : 'Audio'
      label.style.position = 'absolute'
      label.style.inset = '0'
      label.style.margin = '0'
      label.style.display = 'flex'
      label.style.alignItems = 'center'
      label.style.justifyContent = 'center'
      label.style.color = '#f6f5f4'
      label.style.font = '600 42px/1.2 Cantarell, sans-serif'
      label.style.textAlign = 'center'
      label.style.padding = '48px'
      target.appendChild(label)
    }
    return
  }

  if (p.type === 'hymn') {
    renderHymnPayload(target, payload)
    return
  }

  if (p.type === 'deck-slide') {
    const data = /** @type {{ markup?: string; fontCss?: string; width?: number; height?: number; transition?: string; durationMs?: number; autoplayMedia?: boolean; media?: { mediaUrl: string; leftPct: number; topPct: number; widthPct: number; heightPct: number; kind: string }[] }} */ (
      payload
    )
    installDeckFonts(data.fontCss)
    const signature = deckSlideSignature(data)
    if (target.dataset.deckSlide === signature) return
    target.dataset.deckSlide = signature
    const autoplayMedia = data.autoplayMedia !== false
    silenceMedia(target)
    delete target.dataset.hymnSlide
    target.replaceChildren()
    const stage = document.createElement('div')
    stage.style.position = 'absolute'
    stage.style.inset = '0'
    stage.style.background = '#000'
    stage.style.overflow = 'hidden'
    const motion = window.__orionStillCapture
      ? undefined
      : {
          fade: 'orion-deck-fade',
          wipe: 'orion-deck-wipe',
          split: 'orion-deck-split',
          push: 'orion-deck-push',
          cover: 'orion-deck-push',
          uncover: 'orion-deck-uncover'
        }[data.transition]
    if (motion) {
      const ms = data.durationMs || 500
      stage.style.animation = `${motion} ${ms}ms ease forwards`
      pendingSettleMs = Math.max(pendingSettleMs, ms)
    }
    const markup = document.createElement('div')
    markup.style.position = 'absolute'
    markup.style.inset = '0'
    markup.style.color = '#151515'
    markup.innerHTML = data.markup || ''
    for (const embedded of markup.querySelectorAll('video, audio')) {
      embedded.muted = true
      embedded.controls = false
      embedded.removeAttribute('controls')
      embedded.pause()
    }
    const svg = markup.querySelector('svg')
    if (svg) {
      svg.style.width = '100%'
      svg.style.height = '100%'
    }
    stage.appendChild(markup)
    deckMediaCommands = []
    let mediaIndex = 0
    for (const media of data.media ?? []) {
      const el = document.createElement(media.kind === 'audio' ? 'audio' : 'video')
      el.dataset.orionMedia = '1'
      el.src = media.mediaUrl
      el.autoplay = autoplayMedia
      el.controls = false
      el.playsInline = true
      el.muted = !deckAudio
      el.volume = deckAudio ? OUTPUT_MEDIA_VOLUME : 0
      const slot = mediaIndex
      mediaIndex += 1
      const start = () => {
        const pending = deckMediaCommands[slot]
        if (pending) nudgeOutputMedia(el, pending)
        else if (autoplayMedia) void el.play().catch(() => {})
      }
      el.addEventListener('canplay', start, { once: true })
      start()
      el.addEventListener('volumechange', () => {
        const shouldMute = !deckAudio
        if (el.muted !== shouldMute) el.muted = shouldMute
      })
      if (media.kind !== 'audio') {
        el.style.position = 'absolute'
        el.style.left = `${media.leftPct}%`
        el.style.top = `${media.topPct}%`
        el.style.width = `${media.widthPct}%`
        el.style.height = `${media.heightPct}%`
        el.style.objectFit = 'contain'
        el.style.background = '#000'
      }
      stage.appendChild(el)
    }
    target.appendChild(stage)
    return
  }

  if (p.type === 'bible') {
    renderBiblePayload(target, payload)
    return
  }

  silenceMedia(target)
  delete target.dataset.hymnSlide
  delete target.dataset.bibleSlide
  target.replaceChildren()

  if (p.type === 'dictionary') {
    const data = /** @type {{ strongs?: string; lemma?: string; transliteration?: string | null; gloss?: string | null; definition?: string; language?: string; infoBar?: string[]; infoBarActive?: number; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} */ (
      payload
    )
    if (target === baseLayer) paintBackdrop(baseLayer, data)

    const langRaw = typeof data.language === 'string' ? data.language : 'hebrew'
    const langLabel =
      langRaw === 'greek' ? 'Greek' : langRaw === 'aramaic' ? 'Aramaic' : 'Hebrew'

    const wrap = document.createElement('div')
    wrap.className = 'dictionary-proj'
    applyInsetsToElement(wrap, contentInsetsByCategory.dictionary)

    const ref = document.createElement('p')
    ref.className = 'dictionary-proj__ref'
    const refId = document.createElement('span')
    refId.className = 'dictionary-proj__ref-id'
    refId.textContent = data.strongs ?? ''
    ref.append(refId, ` · ${langLabel}`)
    wrap.appendChild(ref)

    const lemma = document.createElement('p')
    lemma.className = 'dictionary-proj__lemma'
    const original = (data.lemma ?? '').trim()
    const reading = typeof data.transliteration === 'string' ? data.transliteration.trim() : ''
    const showReading = reading.length > 0 && reading.toLowerCase() !== original.toLowerCase()
    if (showReading) {
      const readingEl = document.createElement('span')
      readingEl.className = 'dictionary-proj__lemma-reading'
      readingEl.textContent = reading
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      arrow.setAttribute('class', 'dictionary-proj__lemma-arrow')
      arrow.setAttribute('viewBox', '0 0 24 24')
      arrow.setAttribute('aria-hidden', 'true')
      const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      shaft.setAttribute('d', 'M4 12h14')
      shaft.setAttribute('fill', 'none')
      shaft.setAttribute('stroke', 'currentColor')
      shaft.setAttribute('stroke-width', '2.2')
      shaft.setAttribute('stroke-linecap', 'round')
      const head = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      head.setAttribute('d', 'M13 6l6 6-6 6')
      head.setAttribute('fill', 'none')
      head.setAttribute('stroke', 'currentColor')
      head.setAttribute('stroke-width', '2.2')
      head.setAttribute('stroke-linecap', 'round')
      head.setAttribute('stroke-linejoin', 'round')
      arrow.append(shaft, head)
      const originalEl = document.createElement('span')
      originalEl.className = 'dictionary-proj__lemma-original'
      originalEl.dir = 'auto'
      originalEl.textContent = original
      lemma.append(readingEl, arrow, originalEl)
    } else {
      lemma.dir = 'auto'
      lemma.textContent = original
    }
    wrap.appendChild(lemma)

    let detailsEl = null
    let definitionEl = null
    const barItems = Array.isArray(data.infoBar) ? data.infoBar.filter(Boolean) : []
    const barActive =
      typeof data.infoBarActive === 'number' && Number.isFinite(data.infoBarActive)
        ? Math.min(Math.max(0, data.infoBarActive), Math.max(0, barItems.length - 1))
        : 0

    if (barItems.length > 0) {
      const bar = document.createElement('div')
      bar.className = 'dictionary-proj__infobar'
      bar.setAttribute('role', 'group')
      bar.setAttribute('aria-label', 'Lexicon details')
      barItems.forEach((label, index) => {
        const seg = document.createElement('p')
        seg.className =
          index === barActive
            ? 'dictionary-proj__infobar-seg dictionary-proj__infobar-seg--active'
            : 'dictionary-proj__infobar-seg'
        seg.textContent = label
        bar.appendChild(seg)
      })
      wrap.appendChild(bar)
      detailsEl = bar
    } else {
      const readingParts = []
      if (data.transliteration) readingParts.push(data.transliteration)
      if (data.gloss) readingParts.push(data.gloss)
      if (readingParts.length > 0) {
        const reading = document.createElement('p')
        reading.className = 'dictionary-proj__reading'
        if (data.transliteration && data.gloss) {
          reading.append(document.createTextNode(data.transliteration))
          const sep = document.createElement('em')
          sep.textContent = ' — '
          reading.append(sep, document.createTextNode(data.gloss))
        } else {
          reading.textContent = readingParts.join(' — ')
        }
        wrap.appendChild(reading)
        detailsEl = reading
      }
    }

    if (data.definition) {
      const def = document.createElement('p')
      def.className = 'dictionary-proj__definition'
      appendEnglishDefinition(def, data.definition)
      wrap.appendChild(def)
      definitionEl = def
    }

    applyPlacedBlocks(
      wrap,
      [
        { id: 'strongs', el: ref },
        { id: 'lemma', el: lemma },
        ...(detailsEl ? [{ id: 'details', el: detailsEl }] : []),
        ...(definitionEl ? [{ id: 'definition', el: definitionEl }] : [])
      ],
      data.blockLayout
    )
    target.appendChild(wrap)
    return
  }
}

/** @param {{ base?: unknown; overlay?: unknown } | null | undefined} state */
function renderStage(state) {
  const base = state?.base ?? null
  const overlay = state?.overlay ?? null
  pendingSettleMs = 0

  renderPayload(baseLayer, base)

  if (overlay) {
    if (overlayClearTimer !== null) {
      clearTimeout(overlayClearTimer)
      overlayClearTimer = null
    }
    overlayLeaving = false
    overlayLayer.removeAttribute('hidden')
    overlayLayer.style.transition = ''
    overlayLayer.style.opacity = ''
    overlayLayer.style.visibility = ''
    const overlayPayload = /** @type {{ type?: string; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} */ (overlay)
    overlayLayer.classList.add('scrim')
    const overlayWasVisible = overlayLayer.classList.contains('overlay-visible')
    renderPayload(overlayLayer, overlay)
    const overlayHasBg =
      overlayPayload.type === 'bible' ||
      overlayPayload.type === 'dictionary' ||
      overlayPayload.type === 'hymn'
    if (overlayHasBg) paintBackdrop(overlayLayer, overlayPayload)
    else overlayLayer.style.backgroundImage = ''
    // Trigger CSS fade-in
    void overlayLayer.offsetWidth
    overlayLayer.classList.add('overlay-visible')
    if (!overlayWasVisible) pendingSettleMs = Math.max(pendingSettleMs, 420)
  } else {
    const orderUnderlay =
      base?.type === 'image' &&
      typeof base.mediaUrl === 'string' &&
      base.mediaUrl.length > 0
    const fadeOut = orderUnderlay && overlayLayer.classList.contains('overlay-visible')
    const finishOverlay = () => {
      if (overlayLayer.classList.contains('overlay-visible')) return
      overlayLeaving = false
      overlayLayer.setAttribute('hidden', '')
      overlayLayer.classList.remove('scrim')
      overlayLayer.style.backgroundImage = ''
      overlayLayer.style.transition = ''
      overlayLayer.style.opacity = ''
      overlayLayer.style.visibility = ''
      overlayLayer.replaceChildren()
      overlayClearTimer = null
    }
    if (overlayLeaving) {
      /* A second stage push arrives while the overlay is fading off. Leave it alone. */
    } else if (fadeOut) {
      overlayLeaving = true
      for (const slide of baseLayer.querySelectorAll('img.orion-order-slide')) {
        slide.style.animation = ''
        slide.style.opacity = '1'
        slide.style.visibility = 'visible'
      }
      overlayLayer.classList.remove('overlay-visible')
      pendingSettleMs = Math.max(pendingSettleMs, 420)
      if (overlayClearTimer !== null) clearTimeout(overlayClearTimer)
      overlayClearTimer = setTimeout(finishOverlay, 500)
    } else {
      if (overlayClearTimer !== null) {
        clearTimeout(overlayClearTimer)
        overlayClearTimer = null
      }
      finishOverlay()
    }
  }

  const notify = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.orionProjection?.notifyRendered?.()
      })
    })
  }
  const settleMs = pendingSettleMs
  pendingSettleMs = 0
  const slides = baseLayer.querySelectorAll('img.orion-order-slide')
  const incoming = slides.length > 0 ? slides[slides.length - 1] : baseLayer.querySelector('img')
  const arm = () => {
    notify()
    schedulePreviewSettle(settleMs)
  }
  if (incoming && !incoming.complete) {
    incoming.addEventListener('load', arm, { once: true })
    incoming.addEventListener('error', arm, { once: true })
  } else {
    arm()
  }
}

window.__orionRenderStage = renderStage

/** @param {{ bible?: { top: number; right: number; bottom: number; left: number }; hymns?: { top: number; right: number; bottom: number; left: number }; dictionary?: { top: number; right: number; bottom: number; left: number } }} map */
function applyContentInsets(map) {
  if (!map || typeof map !== 'object') return
  if (map.bible) contentInsetsByCategory.bible = map.bible
  if (map.hymns) contentInsetsByCategory.hymns = map.hymns
  if (map.dictionary) contentInsetsByCategory.dictionary = map.dictionary
  refreshLiveContentInsets('bible')
  refreshLiveContentInsets('hymns')
  refreshLiveContentInsets('dictionary')
}

window.__orionApplyContentInsets = applyContentInsets

/** @param {Record<string, string> | null | undefined} vars */
function applyHymnTypography(vars) {
  if (!vars || typeof vars !== 'object') return
  const root = document.documentElement
  for (const [name, value] of Object.entries(vars)) {
    if (
      !(name.startsWith('--hymn-') || name.startsWith('--bible-') || name.startsWith('--dictionary-')) ||
      typeof value !== 'string' ||
      value.length > 180
    ) {
      continue
    }
    root.style.setProperty(name, value)
  }
}

window.__orionApplyHymnTypography = applyHymnTypography

async function boot() {
  const api = window.orionProjection
  if (!api) return

  api.onContent((state) => {
    renderStage(state)
  })

  if (typeof api.onContentInsets === 'function') {
    api.onContentInsets(applyContentInsets)
  }
  if (typeof api.onHymnTypography === 'function') {
    api.onHymnTypography(applyHymnTypography)
  }

  try {
    const insets = await api.pullContentInsets?.()
    if (insets) applyContentInsets(insets)
  } catch {
    /* pull failed — wait for push */
  }

  try {
    const typography = await api.pullHymnTypography?.()
    if (typography) applyHymnTypography(typography)
  } catch {
    /* pull failed — wait for push */
  }

  try {
    const initial = await api.pullContent()
    if (initial) renderStage(initial)
  } catch {
    /* pull failed — wait for push */
  }
}

void boot()
