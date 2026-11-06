const BLOCKED_PROTOCOLS = new Set(['javascript:', 'file:', 'data:'])

export function normalizeWebUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const parsed = new URL(candidate)
    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') return null
    if (BLOCKED_PROTOCOLS.has(protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}

export function webUrlLabel(url: string | null): string {
  if (!url) return 'No page loaded'
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export const WEB_LAST_URL_KEY = 'orion-web-last-url'

export function loadLastWebUrl(): string {
  try {
    return localStorage.getItem(WEB_LAST_URL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveLastWebUrl(input: string): void {
  try {
    localStorage.setItem(WEB_LAST_URL_KEY, input)
  } catch {
    /* ignore */
  }
}
