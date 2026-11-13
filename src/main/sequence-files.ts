import { app, dialog } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import JSZip from 'jszip'
import { isPathUnderRoot } from './projection-paths'
import { hymnalsRoot, mediaRoot, orderImagesRoot, presentationsRoot } from './paths'

function safeSegment(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\.+$/g, '').trim()
  return cleaned.slice(0, 80) || 'item'
}

function userHymnalsRoot(): string {
  return join(app.getPath('userData'), 'hymnals')
}

function hymnalIdOk(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,80}$/.test(id)
}

function findHymnalDir(id: string): string | null {
  if (!hymnalIdOk(id)) return null
  const user = join(userHymnalsRoot(), id)
  if (existsSync(user) && isPathUnderRoot(user, userHymnalsRoot())) return user
  const builtin = join(hymnalsRoot(), id)
  if (existsSync(builtin) && isPathUnderRoot(builtin, hymnalsRoot())) return builtin
  return null
}

async function addDirectory(zip: JSZip, dir: string, zipPath: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    const rel = `${zipPath}/${entry.name}`
    if (entry.isDirectory()) await addDirectory(zip, abs, rel)
    else if (entry.isFile()) zip.file(rel, await readFile(abs))
  }
}

async function bundleSequence(json: string): Promise<Buffer> {
  const parsed = JSON.parse(json) as { version?: number; items?: Record<string, unknown>[] }
  const items = Array.isArray(parsed.items) ? parsed.items : []
  const zip = new JSZip()
  const packedHymnals = new Set<string>()
  for (const item of items) {
    if (item.kind === 'hymn' && typeof item.hymnalId === 'string' && !packedHymnals.has(item.hymnalId)) {
      const dir = findHymnalDir(item.hymnalId)
      if (dir) {
        packedHymnals.add(item.hymnalId)
        await addDirectory(zip, dir, `hymnals/${item.hymnalId}`)
      }
    }
    if (item.kind === 'order-image' && typeof item.path === 'string' && typeof item.folder === 'string') {
      const source = item.path
      if (!existsSync(source) || !isPathUnderRoot(source, orderImagesRoot())) continue
      const rel = `order/${safeSegment(item.folder)}/${basename(source)}`
      zip.file(rel, await readFile(source))
      item.path = rel
    }
    if (item.kind === 'media' && typeof item.path === 'string' && typeof item.folder === 'string') {
      const source = item.path
      if (!existsSync(source) || !isPathUnderRoot(source, mediaRoot())) continue
      const rel = `media/${safeSegment(item.folder)}/${basename(source)}`
      zip.file(rel, await readFile(source))
      item.path = rel
    }
    if (item.kind === 'presentation' && typeof item.deckId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(item.deckId)) {
      const dir = join(presentationsRoot(), item.deckId)
      if (!existsSync(dir) || !isPathUnderRoot(dir, presentationsRoot())) continue
      await addDirectory(zip, dir, `decks/${item.deckId}`)
    }
  }
  parsed.version = 1
  zip.file('sequence.json', JSON.stringify(parsed, null, 2))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

async function installBundledSequence(buffer: Buffer): Promise<string | null> {
  const zip = await JSZip.loadAsync(buffer)
  const sequenceFile = zip.file('sequence.json')
  if (!sequenceFile) return null
  const parsed = JSON.parse(await sequenceFile.async('string')) as { items?: Record<string, unknown>[] }
  const items = Array.isArray(parsed.items) ? parsed.items : []
  const installedDecks = new Set<string>()

  for (const item of items) {
    if (item.kind === 'order-image' && typeof item.path === 'string' && typeof item.folder === 'string') {
      const rel = item.path.replace(/\\/g, '/')
      if (!rel.startsWith('order/') || rel.includes('..')) continue
      const packed = zip.file(rel)
      if (!packed) continue
      const folder = safeSegment(item.folder)
      const destDir = join(orderImagesRoot(), folder)
      await mkdir(destDir, { recursive: true })
      const dest = join(destDir, basename(rel))
      if (!isPathUnderRoot(dest, orderImagesRoot())) continue
      if (!existsSync(dest)) await writeFile(dest, await packed.async('nodebuffer'))
      item.folder = folder
      item.path = dest
    }
    if (item.kind === 'media' && typeof item.path === 'string' && typeof item.folder === 'string') {
      const rel = item.path.replace(/\\/g, '/')
      if (!rel.startsWith('media/') || rel.includes('..')) continue
      const packed = zip.file(rel)
      if (!packed) continue
      const folder = safeSegment(item.folder)
      const destDir = join(mediaRoot(), folder)
      await mkdir(destDir, { recursive: true })
      const dest = join(destDir, basename(rel))
      if (!isPathUnderRoot(dest, mediaRoot())) continue
      if (!existsSync(dest)) await writeFile(dest, await packed.async('nodebuffer'))
      item.folder = folder
      item.path = dest
    }
    if (item.kind === 'hymn' && typeof item.hymnalId === 'string' && hymnalIdOk(item.hymnalId)) {
      if (findHymnalDir(item.hymnalId)) continue
      const prefix = `hymnals/${item.hymnalId}/`
      const destRoot = join(userHymnalsRoot(), item.hymnalId)
      if (!isPathUnderRoot(destRoot, userHymnalsRoot())) continue
      let wrote = false
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !entry.name.startsWith(prefix)) continue
        const rel = entry.name.slice(prefix.length)
        if (!rel || rel.includes('..')) continue
        const dest = join(destRoot, rel)
        if (!isPathUnderRoot(dest, destRoot)) continue
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, await entry.async('nodebuffer'))
        wrote = true
      }
      if (wrote) continue
    }
    if (item.kind === 'presentation' && typeof item.deckId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(item.deckId)) {
      if (installedDecks.has(item.deckId)) continue
      installedDecks.add(item.deckId)
      const prefix = `decks/${item.deckId}/`
      const destRoot = join(presentationsRoot(), item.deckId)
      if (existsSync(destRoot)) continue
      if (!isPathUnderRoot(destRoot, presentationsRoot())) continue
      await mkdir(destRoot, { recursive: true })
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !entry.name.startsWith(prefix)) continue
        const rel = entry.name.slice(prefix.length)
        if (!rel || rel.includes('..')) continue
        const dest = join(destRoot, rel)
        if (!isPathUnderRoot(dest, destRoot)) continue
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, await entry.async('nodebuffer'))
      }
    }
  }
  return JSON.stringify({ version: 1, items })
}

export async function exportSequenceFileToDialog(
  json: string,
  suggestedName: string,
  bundleContent = true
): Promise<string | null> {
  const res = await dialog.showSaveDialog({
    title: bundleContent ? 'Export Orion sequence with content' : 'Export Orion sequence',
    defaultPath: suggestedName.endsWith('.orionseq') ? suggestedName : `${suggestedName}.orionseq`,
    filters: [{ name: 'Orion sequence', extensions: ['orionseq'] }]
  })
  if (res.canceled || !res.filePath) return null
  if (!bundleContent) {
    await writeFile(res.filePath, json, 'utf8')
    return res.filePath
  }
  const packed = await bundleSequence(json)
  await writeFile(res.filePath, packed)
  return res.filePath
}

export async function importSequenceFileFromDialog(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import Orion sequence',
    properties: ['openFile'],
    filters: [
      { name: 'Orion sequence', extensions: ['orionseq', 'json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  const filePath = res.filePaths[0]
  if (res.canceled || !filePath) return null
  const bytes = await readFile(filePath)
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return installBundledSequence(bytes)
  }
  return bytes.toString('utf8')
}
