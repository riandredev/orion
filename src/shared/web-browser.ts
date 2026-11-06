/** Chrome user agent so sites such as YouTube play inside Orion instead of refusing Electron. */
export const WEB_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const WEB_TRY_PLAY_SCRIPT = `(() => {
  const video = document.querySelector('video')
  if (!video) return
  const play = () => {
    video.play().catch(() => {})
  }
  if (video.readyState >= 2) play()
  else video.addEventListener('canplay', play, { once: true })
})()`

/** Keep the page Fullscreen API inside the webview instead of the Orion window. */
export const WEB_CONTAIN_FULLSCREEN_SCRIPT = `(() => {
  if (window.__orionContainFs) return
  window.__orionContainFs = true
  const style = document.createElement('style')
  style.textContent = 'html.orion-fs,html.orion-fs body{background:#000!important;overflow:hidden!important}html.orion-fs .orion-fs-target{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;z-index:2147483646!important;background:#000!important}'
  document.documentElement.appendChild(style)
  let active = null
  window.__orionNativeExitFullscreen = document.exitFullscreen ? document.exitFullscreen.bind(document) : null
  const enter = function () {
    if (active && active !== this) active.classList.remove('orion-fs-target')
    active = this
    this.classList.add('orion-fs-target')
    document.documentElement.classList.add('orion-fs')
    document.dispatchEvent(new Event('fullscreenchange'))
    document.dispatchEvent(new Event('webkitfullscreenchange'))
    return Promise.resolve()
  }
  const exit = () => {
    if (active) active.classList.remove('orion-fs-target')
    active = null
    document.documentElement.classList.remove('orion-fs')
    document.dispatchEvent(new Event('fullscreenchange'))
    document.dispatchEvent(new Event('webkitfullscreenchange'))
    return Promise.resolve()
  }
  Element.prototype.requestFullscreen = enter
  Element.prototype.webkitRequestFullscreen = enter
  Element.prototype.webkitRequestFullScreen = enter
  document.exitFullscreen = exit
  document.webkitExitFullscreen = exit
  document.webkitCancelFullScreen = exit
  const define = (key, getter) => {
    try { Object.defineProperty(document, key, { configurable: true, get: getter }) } catch (e) {}
  }
  define('fullscreenElement', () => document.documentElement.classList.contains('orion-fs') ? (active || document.documentElement) : null)
  define('webkitFullscreenElement', () => document.fullscreenElement)
  define('fullscreenEnabled', () => true)
  define('webkitFullscreenEnabled', () => true)
})()`

const YT_CAPTION_HELPERS = `
  function orionCaptionsOn() {
    const player = document.getElementById('movie_player')
    if (player && typeof player.getOption === 'function') {
      try {
        const track = player.getOption('captions', 'track')
        if (track && (track.languageCode || track.languageName)) return true
      } catch (e) {}
    }
    const btn = document.querySelector('.ytp-subtitles-button')
    if (!btn) return false
    return btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('ytp-subtitles-button-active')
  }
  function orionSetCaptions(on) {
    const player = document.getElementById('movie_player')
    const active = orionCaptionsOn()
    if (player && typeof player.setOption === 'function' && active !== on) {
      try {
        if (on) {
          if (typeof player.loadModule === 'function') player.loadModule('captions')
          const list = typeof player.getOption === 'function' ? player.getOption('captions', 'tracklist') || [] : []
          const next = list.find((item) => item && item.languageCode)
          if (next) player.setOption('captions', 'track', next)
        } else {
          player.setOption('captions', 'track', {})
          if (typeof player.unloadModule === 'function') player.unloadModule('captions')
        }
      } catch (e) {}
    } else if (active !== on) {
      const btn = document.querySelector('.ytp-subtitles-button')
      if (btn) btn.click()
    }
    document.querySelectorAll('.ytp-caption-window-container, .caption-window').forEach((el) => {
      el.style.display = on ? '' : 'none'
    })
  }
`

export const WEB_CAPTIONS_HOLD_OFF_SCRIPT = `(() => {
  if (window.__orionCaptionsHold) return
  window.__orionCaptionsHold = true
  ${YT_CAPTION_HELPERS}
  let holdOff = true
  let href = location.href
  window.__orionCaptionsWanted = false
  const release = () => {
    holdOff = false
    setTimeout(() => { window.__orionCaptionsWanted = orionCaptionsOn() }, 50)
  }
  document.addEventListener('click', (event) => {
    const node = event.target && event.target.closest ? event.target.closest('.ytp-subtitles-button') : null
    if (node) release()
  }, true)
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'c' && event.key !== 'C') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const tag = event.target && event.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target && event.target.isContentEditable)) return
    release()
  }, true)
  window.addEventListener('yt-navigate-finish', () => {
    holdOff = true
    window.__orionCaptionsWanted = false
  })
  setInterval(() => {
    if (location.href !== href) {
      href = location.href
      holdOff = true
      window.__orionCaptionsWanted = false
    }
    if (!holdOff) {
      window.__orionCaptionsWanted = orionCaptionsOn()
      return
    }
    window.__orionCaptionsWanted = false
    const host = location.hostname
    if (host.indexOf('youtube.com') === -1 && host.indexOf('youtu.be') === -1) return
    orionSetCaptions(false)
  }, 400)
})()`

export const WEB_READ_MEDIA_SCRIPT = `(() => {
  const video = document.querySelector('video')
  if (!video) return null
  ${YT_CAPTION_HELPERS}
  return {
    time: Number(video.currentTime) || 0,
    paused: !!video.paused,
    rate: Number(video.playbackRate) || 1,
    fullscreen: document.documentElement.classList.contains('orion-fs'),
    captions: window.__orionCaptionsWanted === false ? false : orionCaptionsOn()
  }
})()`

/** Follow the operator webview's video clock. Audio is muted separately. */
export const WEB_SYNC_INSTALL_SCRIPT = `(() => {
  if (window.__orionWebMedia) return
  ${YT_CAPTION_HELPERS}
  if (!document.getElementById('orion-fs-style')) {
    const style = document.createElement('style')
    style.id = 'orion-fs-style'
    style.textContent = 'html.orion-output-fs{background:#000!important;overflow:hidden!important}html.orion-output-fs body{display:none!important}html.orion-output-fs #movie_player,html.orion-output-fs .html5-video-player,html.orion-output-fs video{display:block!important;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;z-index:2147483647!important;background:#000!important}'
    document.documentElement.appendChild(style)
  }
  const playerEl = () => document.querySelector('#movie_player') || document.querySelector('.html5-video-player') || document.querySelector('video')
  const parkPlayer = (target) => {
    if (!target || target.parentNode === document.documentElement) return
    if (!window.__orionFsHome) window.__orionFsHome = { parent: target.parentNode, next: target.nextSibling }
    document.documentElement.appendChild(target)
  }
  const restorePlayer = () => {
    const target = playerEl()
    const home = window.__orionFsHome
    window.__orionFsHome = null
    if (!target || !home || !home.parent) return
    if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(target, home.next)
    else home.parent.appendChild(target)
  }
  window.__orionWebMedia = (command) => {
    if (!command) return
    const epoch = Number(command.epoch) || 0
    if (epoch < (window.__orionWebEpoch || 0)) return
    window.__orionWebEpoch = epoch
    const video = document.querySelector('video')
    if (video) {
      const time = Number(command.time) || 0
      const rate = Number(command.rate) || 1
      const paused = !!command.paused
      if (Math.abs((video.playbackRate || 1) - rate) > 0.01) video.playbackRate = rate
      const drift = Math.abs((video.currentTime || 0) - time)
      const live = !Number.isFinite(video.duration)
      if (drift > (live ? 1.5 : 0.35)) {
        try { video.currentTime = time } catch (e) {}
      }
      if (paused) {
        if (!video.paused) video.pause()
      } else if (video.paused) {
        const play = video.play()
        if (play && play.catch) play.catch(() => {})
      }
    }
    const root = document.documentElement
    const want = !!command.fullscreen
    if (want) {
      const target = playerEl()
      if (target) parkPlayer(target)
      if (!root.classList.contains('orion-output-fs')) root.classList.add('orion-output-fs')
      if (!window.__orionFsHold) {
        window.__orionFsHold = setInterval(() => {
          if (!document.documentElement.classList.contains('orion-output-fs')) return
          const live = playerEl()
          if (live) parkPlayer(live)
        }, 200)
      }
      if (!window.__orionContainFs && target && target.requestFullscreen && !document.fullscreenElement && !window.__orionFsRequested) {
        window.__orionFsRequested = true
        const pending = target.requestFullscreen()
        if (pending && pending.catch) pending.catch(() => { window.__orionFsRequested = false })
      }
    } else if (root.classList.contains('orion-output-fs') || document.fullscreenElement) {
      window.__orionFsRequested = false
      if (window.__orionFsHold) {
        clearInterval(window.__orionFsHold)
        window.__orionFsHold = 0
      }
      root.classList.remove('orion-output-fs')
      if (!window.__orionContainFs && document.fullscreenElement && document.exitFullscreen) {
        const pending = document.exitFullscreen()
        if (pending && pending.catch) pending.catch(() => {})
      }
      restorePlayer()
    }
    orionSetCaptions(!!command.captions)
  }
})()`
