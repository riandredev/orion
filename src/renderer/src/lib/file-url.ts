/** Operator pages are served over http in development, which cannot load file:// images. */
export function displayFileUrl(value: string): string {
  if (!value) return ''
  if (
    value.startsWith('orion-file:') ||
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('http:') ||
    value.startsWith('https:')
  ) {
    return value
  }
  let path = value
  if (path.startsWith('file:')) {
    path = decodeURIComponent(path.replace(/^file:\/*/, ''))
  }
  path = path.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (/^[A-Za-z]:/.test(path)) path = `/${path}`
  return `orion-file://media${encodeURI(path)}`
}
