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
  const wait = ms > 0 ? ms + 80 : 48
  const due = Date.now() + wait
  // A second stage push arrives immediately and would snapshot the fade mid-way.
  // Keep the capture that lands after the animation.
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

function applyDeckAudioFlag() {
  for (const el of document.querySelectorAll('[data-orion-media], [data-orion-library-media]')) {
    const shouldMute = !deckAudio
    if (el.muted !== shouldMute) el.muted = shouldMute
    if (shouldMute && el.volume !== 0) el.volume = 0
    if (!shouldMute && el.volume === 0) el.volume = 1
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

  const named = ['crossfade', 'fade', 'wipe', 'push', 'cover', 'uncover', 'split']
  const animation = named.includes(data.animation) ? data.animation : 'cut'
  const durationMs = Math.min(5000, Math.max(0, Math.round(Number(data.durationMs) || 0)))
  const img = document.createElement('img')
  img.className = 'orion-order-slide'
  img.alt = ''
  img.src = mediaUrl

  const previous = showing && showing.getAttribute('src') !== mediaUrl ? showing : null
  const pending = imageMotionTimers.get(target)
  if (pending) window.clearTimeout(pending)

  const clearMotion = (node) => {
    node.style.animation = ''
    node.style.opacity = ''
    node.style.transform = ''
    node.style.clipPath = ''
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
  }
  settleAfter(durationMs)
}

/** @param {unknown} payload */
function renderPayload(target, payload) {
  if (!payload || typeof payload !== 'object') {
    target.replaceChildren()
    return
  }
  const p = /** @type {{ type?: string }} */ (payload)

  if (p.type === 'image') {
    renderOrderImage(target, /** @type {{ mediaUrl?: string; animation?: string; durationMs?: number }} */ (payload))
    return
  }

  if (p.type === 'media') {
    const data = /** @type {{ mediaUrl?: string; kind?: string; name?: string }} */ (payload)
    const mediaUrl = typeof data.mediaUrl === 'string' ? data.mediaUrl : ''
    const existing = target.querySelector('[data-orion-library-media]')
    if (existing instanceof HTMLMediaElement && existing.getAttribute('src') === mediaUrl) return
    silenceMedia(target)
    target.replaceChildren()
    if (!mediaUrl) return
    const kind = data.kind === 'audio' ? 'audio' : 'video'
    const el = document.createElement(kind)
    el.dataset.orionLibraryMedia = '1'
    el.src = mediaUrl
    el.autoplay = false
    el.controls = false
    el.playsInline = true
    el.muted = !deckAudio
    el.volume = deckAudio ? 1 : 0
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

  silenceMedia(target)
  target.replaceChildren()

  if (p.type === 'deck-slide') {
    const data = /** @type {{ markup?: string; width?: number; height?: number; transition?: string; durationMs?: number; media?: { mediaUrl: string; leftPct: number; topPct: number; widthPct: number; heightPct: number; kind: string }[] }} */ (
      payload
    )
    const stage = document.createElement('div')
    stage.style.position = 'absolute'
    stage.style.inset = '0'
    stage.style.background = '#000'
    stage.style.overflow = 'hidden'
    const motion = {
      fade: 'orion-deck-fade',
      wipe: 'orion-deck-wipe',
      split: 'orion-deck-split',
      push: 'orion-deck-push',
      cover: 'orion-deck-push',
      uncover: 'orion-deck-uncover'
    }[data.transition]
    if (motion) {
      const ms = data.durationMs || 500
      stage.style.animation = `${motion} ${ms}ms ease`
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
      el.autoplay = true
      el.controls = false
      el.playsInline = true
      el.muted = !deckAudio
      const slot = mediaIndex
      mediaIndex += 1
      const start = () => {
        const pending = deckMediaCommands[slot]
        if (pending) nudgeOutputMedia(el, pending)
        else void el.play().catch(() => {})
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
    const data = /** @type {{ reference?: string; locationLabel?: string; translationLabel?: string; verses?: { number: number; text: string }[]; highlightVerse?: number; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} */ (
      payload
    )
    if (target === baseLayer) {
      baseLayer.style.backgroundColor = data.backgroundColor || '#000000'
      baseLayer.style.backgroundSize = data.backgroundFit === 'contain' ? 'contain' : 'cover'
      baseLayer.style.backgroundPosition = 'center'
      baseLayer.style.backgroundRepeat = 'no-repeat'
      if (data.backgroundMediaUrl) {
        const dim = typeof data.backgroundDimOpacity === 'number'
          ? Math.min(95, Math.max(0, data.backgroundDimOpacity)) / 100
          : 0.55
        baseLayer.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url(${JSON.stringify(data.backgroundMediaUrl)})`
      } else {
        baseLayer.style.backgroundImage = ''
      }
    }

    const verses = data.verses ?? []
    const active =
      verses.find((v) => v.number === data.highlightVerse) ?? verses[0] ?? null
    if (!active) return

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

    target.appendChild(wrap)
    requestAnimationFrame(() => {
      fitBibleVerse(text)
    })
    return
  }

  if (p.type === 'dictionary') {
    const data = /** @type {{ strongs?: string; lemma?: string; transliteration?: string | null; gloss?: string | null; definition?: string; language?: string; infoBar?: string[]; infoBarActive?: number; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} */ (
      payload
    )
    if (target === baseLayer) {
      baseLayer.style.backgroundColor = data.backgroundColor || '#000000'
      baseLayer.style.backgroundSize = data.backgroundFit === 'contain' ? 'contain' : 'cover'
      baseLayer.style.backgroundPosition = 'center'
      baseLayer.style.backgroundRepeat = 'no-repeat'
      if (data.backgroundMediaUrl) {
        const dim = typeof data.backgroundDimOpacity === 'number'
          ? Math.min(95, Math.max(0, data.backgroundDimOpacity)) / 100
          : 0.55
        baseLayer.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url(${JSON.stringify(data.backgroundMediaUrl)})`
      } else {
        baseLayer.style.backgroundImage = ''
      }
    }

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
      }
    }

    if (data.definition) {
      const def = document.createElement('p')
      def.className = 'dictionary-proj__definition'
      appendEnglishDefinition(def, data.definition)
      wrap.appendChild(def)
    }

    target.appendChild(wrap)
    return
  }

  if (p.type === 'hymn') {
    const data = /** @type {{ number?: number; title?: string; author?: string; slideKind?: string; stanzaKind?: string; verse?: number; versePart?: number; versePartCount?: number; lines?: string[]; backgroundMediaUrl?: string; backgroundColor?: string; backgroundDimOpacity?: number; backgroundFit?: string }} */ (
      payload
    )
    if (target === baseLayer) {
      baseLayer.style.backgroundColor = data.backgroundColor || '#000000'
      baseLayer.style.backgroundSize = data.backgroundFit === 'contain' ? 'contain' : 'cover'
      baseLayer.style.backgroundPosition = 'center'
      baseLayer.style.backgroundRepeat = 'no-repeat'
      if (data.backgroundMediaUrl) {
        const dim = typeof data.backgroundDimOpacity === 'number'
          ? Math.min(95, Math.max(0, data.backgroundDimOpacity)) / 100
          : 0.55
        baseLayer.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url(${JSON.stringify(data.backgroundMediaUrl)})`
      } else {
        baseLayer.style.backgroundImage = ''
      }
    }

    const slideKind = data.slideKind || 'lyrics'

    if (slideKind === 'end') {
      return
    }

    const wrap = document.createElement('div')
    wrap.className = slideKind === 'title' ? 'hymn-proj hymn-proj--title' : 'hymn-proj'
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
      appendHymnAuthor(wrap, data.author)
      target.appendChild(wrap)
      fitHymnTitleSlide(hero)
      return
    }

    const top = document.createElement('div')
    top.className = 'hymn-proj__top'

    const corner = document.createElement('span')
    corner.className = 'hymn-proj__corner'
    const kind = data.stanzaKind || 'verse'
    if (kind === 'refrain') {
      corner.textContent = 'Refrain'
    } else if (kind === 'chorus' || kind === 'bridge' || kind === 'intro') {
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
    appendHymnAuthor(wrap, data.author)
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
    overlayLayer.style.backgroundColor = overlayPayload.backgroundColor || '#000000'
    overlayLayer.style.backgroundSize = overlayPayload.backgroundFit === 'contain' ? 'contain' : 'cover'
    const overlayHasBg =
      overlayPayload.type === 'bible' ||
      overlayPayload.type === 'dictionary' ||
      overlayPayload.type === 'hymn'
    if (overlayHasBg && overlayPayload.backgroundMediaUrl) {
      const dim = typeof overlayPayload.backgroundDimOpacity === 'number'
        ? Math.min(95, Math.max(0, overlayPayload.backgroundDimOpacity)) / 100
        : 0.55
      overlayLayer.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, ${dim}), rgba(0, 0, 0, ${dim})), url(${JSON.stringify(overlayPayload.backgroundMediaUrl)})`
    } else {
      overlayLayer.style.backgroundImage = ''
    }
    renderPayload(overlayLayer, overlay)
    // Trigger CSS fade-in
    void overlayLayer.offsetWidth
    overlayLayer.classList.add('overlay-visible')
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
