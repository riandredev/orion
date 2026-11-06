import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  WEB_BROWSER_USER_AGENT,
  WEB_CAPTIONS_HOLD_OFF_SCRIPT,
  WEB_CONTAIN_FULLSCREEN_SCRIPT,
  WEB_READ_MEDIA_SCRIPT
} from '../../../shared/web-browser'
import { AppIcon } from './AppIcon'
import { publishWebMedia } from '../lib/web-media-sync'
import { webUrlLabel } from '../lib/web-url'

export type WebViewControls = {
  reload: () => void
  goBack: () => void
  goForward: () => void
}

type WebWorkspaceProps = {
  pageUrl: string | null
  projecting: boolean
  audible: boolean
  onPageUrlChange: (url: string) => void
  onTitleChange: (title: string) => void
  onNavigationStateChange: (canGoBack: boolean, canGoForward: boolean) => void
  onControlsReady: (controls: WebViewControls | null) => void
}

type WebviewElement = HTMLElement & {
  reload: () => void
  goBack: () => void
  goForward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  getURL: () => string
  getWebContentsId: () => number
  loadURL: (url: string) => void
  executeJavaScript: (code: string) => Promise<unknown>
}

function muteGuest(webview: WebviewElement, muted: boolean): void {
  try {
    const webContentsId = webview.getWebContentsId()
    if (webContentsId) window.orion.setGuestAudioMuted(webContentsId, muted)
  } catch {
    /* guest is not attached yet */
  }
}

function syncNavigationState(
  webview: WebviewElement,
  onNavigationStateChange: (back: boolean, forward: boolean) => void
): void {
  onNavigationStateChange(webview.canGoBack(), webview.canGoForward())
}

export function WebWorkspace({
  pageUrl,
  projecting,
  audible,
  onPageUrlChange,
  onTitleChange,
  onNavigationStateChange,
  onControlsReady
}: WebWorkspaceProps): ReactElement {
  const webviewRef = useRef<WebviewElement | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const guestReadyRef = useRef(false)
  const audibleRef = useRef(audible)
  audibleRef.current = audible
  const [frame, setFrame] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const frameEl = frameRef.current
    if (!frameEl) return
    const measure = (): void => {
      const rect = frameEl.getBoundingClientRect()
      setFrame({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height))
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frameEl)
    return () => observer.disconnect()
  }, [pageUrl])

  const attachWebview = useCallback(
    (node: WebviewElement | null) => {
      webviewRef.current = node
      guestReadyRef.current = false
      if (!node) {
        onControlsReady(null)
        return
      }

      onControlsReady({
        reload: () => node.reload(),
        goBack: () => node.goBack(),
        goForward: () => node.goForward()
      })
    },
    [onControlsReady]
  )

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const onNavigate = (): void => {
      const url = webview.getURL()
      if (url && url !== 'about:blank') {
        onPageUrlChange(url)
      }
      syncNavigationState(webview, onNavigationStateChange)
    }

    const onTitle = (...args: unknown[]): void => {
      const title = typeof args[1] === 'string' ? args[1] : ''
      if (title) onTitleChange(title)
    }

    const fitGuest = (): void => {
      const rect = webview.getBoundingClientRect()
      const width = Math.max(0, Math.floor(rect.width))
      const height = Math.max(0, Math.floor(rect.height))
      if (width > 0 && height > 0) {
        webview.style.width = `${width}px`
        webview.style.height = `${height}px`
      }
    }

    const onStartLoading = (): void => {
      guestReadyRef.current = false
    }

    const onStopLoading = (): void => {
      guestReadyRef.current = true
      fitGuest()
      syncNavigationState(webview, onNavigationStateChange)
      muteGuest(webview, !audibleRef.current)
      void webview.executeJavaScript(WEB_CONTAIN_FULLSCREEN_SCRIPT).catch(() => {
        /* guest navigated away */
      })
      void webview.executeJavaScript(WEB_CAPTIONS_HOLD_OFF_SCRIPT).catch(() => {
        /* guest navigated away */
      })
    }

    webview.addEventListener('did-navigate', onNavigate)
    webview.addEventListener('did-navigate-in-page', onNavigate)
    webview.addEventListener('page-title-updated', onTitle as EventListener)
    webview.addEventListener('dom-ready', fitGuest)
    webview.addEventListener('did-start-loading', onStartLoading)
    webview.addEventListener('did-stop-loading', onStopLoading)

    return () => {
      guestReadyRef.current = false
      webview.removeEventListener('did-navigate', onNavigate)
      webview.removeEventListener('did-navigate-in-page', onNavigate)
      webview.removeEventListener('page-title-updated', onTitle as EventListener)
      webview.removeEventListener('dom-ready', fitGuest)
      webview.removeEventListener('did-start-loading', onStartLoading)
      webview.removeEventListener('did-stop-loading', onStopLoading)
    }
  }, [pageUrl, frame.width, frame.height, onNavigationStateChange, onPageUrlChange, onTitleChange])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || !guestReadyRef.current) return
    muteGuest(webview, !audible)
  }, [audible, pageUrl, frame.width, frame.height])

  useEffect(() => {
    if (!projecting) return
    let epoch = 0
    let last: { time: number; paused: boolean; fullscreen: boolean; captions: boolean } | null = null
    let stopped = false
    const tick = (): void => {
      const webview = webviewRef.current
      if (!webview || !guestReadyRef.current) return
      void webview
        .executeJavaScript(WEB_READ_MEDIA_SCRIPT)
        .then((raw) => {
          if (stopped || !raw || typeof raw !== 'object') return
          const body = raw as {
            time?: unknown
            paused?: unknown
            rate?: unknown
            fullscreen?: unknown
            captions?: unknown
          }
          const time = typeof body.time === 'number' && Number.isFinite(body.time) ? body.time : 0
          const paused = body.paused === true
          const rate = typeof body.rate === 'number' && body.rate > 0 ? body.rate : 1
          const fullscreen = body.fullscreen === true
          const captions = body.captions === true
          const jumped = last != null && Math.abs(time - last.time) > 1.2
          const changed =
            last == null ||
            paused !== last.paused ||
            last.fullscreen !== fullscreen ||
            last.captions !== captions ||
            jumped
          if (changed) epoch += 1
          last = { time, paused, fullscreen, captions }
          publishWebMedia(time, paused, rate, fullscreen, captions, epoch)
        })
        .catch(() => {
          /* guest is navigating */
        })
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [projecting, pageUrl, frame.width, frame.height])

  return (
    <div className="web-workspace">
      <div ref={frameRef} className="web-viewport">
        {pageUrl && frame.width > 0 && frame.height > 0 ? (
          <webview
            ref={attachWebview as never}
            className="web-viewport__webview"
            src={pageUrl}
            useragent={WEB_BROWSER_USER_AGENT}
            webpreferences="contextIsolation=yes,autoplayPolicy=no-user-gesture-required"
            allowpopups
            style={{ width: frame.width, height: frame.height }}
          />
        ) : pageUrl ? null : (
          <div className="web-viewport__empty">
            <span className="web-viewport__empty-icon" aria-hidden="true">
              <AppIcon name="globe" size={40} />
            </span>
            <p className="adw-title-2">Web</p>
            <p className="adw-caption">
              Enter a URL in the address bar above — YouTube, live streams, or any site you need
              on screen.
            </p>
          </div>
        )}
      </div>
      {pageUrl ? (
        <footer className="web-status adw-caption" aria-live="polite">
          {webUrlLabel(pageUrl)}
        </footer>
      ) : null}
    </div>
  )
}
