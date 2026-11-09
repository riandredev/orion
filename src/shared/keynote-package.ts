import JSZip from 'jszip'

const SLIDE_IWA = /(?:^|\/)slide(?:-[^/]+)?\.iwa$/i
const INDEX_ZIP = /(?:^|\/)index\.zip$/i
const OPERATION_STORAGE = /(?:^|\/)operationstorage\.iwa$/i

function slideNames(zip: JSZip): string[] {
  const names: string[] = []
  zip.forEach((path, entry) => {
    if (!entry.dir && SLIDE_IWA.test(path)) names.push(path)
  })
  return names
}

function findIndexZip(zip: JSZip): JSZip.JSZipObject | null {
  const match = Object.values(zip.files).find((entry) => !entry.dir && INDEX_ZIP.test(entry.name))
  return match ?? null
}

function copyBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data)
  const copy = new ArrayBuffer(view.byteLength)
  new Uint8Array(copy).set(view)
  return copy
}

/** Slides live in Index/*.iwa, often inside a nested Index.zip. Master slides are not slides. */
export async function countKeynoteSlides(data: Uint8Array): Promise<number> {
  const zip = await JSZip.loadAsync(data)
  const nested = findIndexZip(zip)
  if (nested) {
    const inner = await JSZip.loadAsync(await nested.async('uint8array'))
    return slideNames(inner).length
  }
  return slideNames(zip).length
}

/**
 * Drop Keynote's operation log. A malformed OperationStorage.iwa makes the
 * whole document fall back to a single text scene.
 */
export async function prepareKeynotePackage(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(data)
  const nested = findIndexZip(zip)
  if (!nested) return copyBuffer(data)

  const inner = await JSZip.loadAsync(await nested.async('uint8array'))
  const dropped = Object.keys(inner.files).filter((name) => OPERATION_STORAGE.test(name))
  if (dropped.length === 0) return copyBuffer(data)
  for (const name of dropped) inner.remove(name)
  const nestedBytes = await inner.generateAsync({ type: 'uint8array', compression: 'STORE' })
  zip.file(nested.name, nestedBytes)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
}
