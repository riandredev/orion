/** file:// helpers that keep Windows drive paths and Linux absolute paths intact. */

export function localPathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

export function fileUrlToLocalPath(src: string): string | null {
  if (!src.startsWith('file:')) return null
  try {
    const url = new URL(src)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname.startsWith('/') && /^[A-Za-z]:/.test(pathname.slice(1, 3))) {
      pathname = pathname.slice(1).replace(/\//g, '\\')
    }
    return pathname.length > 0 ? pathname : null
  } catch {
    return null
  }
}
