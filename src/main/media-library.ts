import { dialog } from 'electron'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, rename, rm, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { isPathUnderRoot } from './projection-paths'
import { mediaRoot } from './paths'

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.ogg'])

export type MediaLibraryItem = {
  name: string
  path: string
  kind: 'video' | 'audio'
  size: number
  modifiedMs: number
}

const DEFAULT_FOLDERS = ['Videos', 'Music', 'Library'] as const

export type MediaFolderInfo = {
  name: string
  itemCount: number
}

function kindFor(fileName: string): MediaLibraryItem['kind'] | null {
  const ext = extname(fileName).toLowerCase()
  if (VIDEO_EXT.has(ext)) return 'video'
  if (AUDIO_EXT.has(ext)) return 'audio'
  return null
}

function sanitizeFolderName(raw: string): string | null {
  const name = raw.trim().replace(/[. ]+$/g, '')
  if (!name || name === '.' || name === '..') return null
  if (name.length > 80) return null
  if (/[<>:"/\\|?*\u0000-\u001F]/.test(name)) return null
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) return null
  return name
}

function resolveFolder(rawName: string): string | null {
  const name = sanitizeFolderName(rawName)
  if (!name) return null
  const root = mediaRoot()
  const folderPath = join(root, name)
  if (!isPathUnderRoot(folderPath, root) || folderPath === root) return null
  return folderPath
}

async function shelveLooseFiles(): Promise<void> {
  const root = mediaRoot()
  await mkdir(root, { recursive: true })
  const names = await readdir(root)
  const loose: string[] = []
  for (const name of names) {
    const path = join(root, name)
    const info = await stat(path).catch(() => null)
    if (info?.isFile() && kindFor(name)) loose.push(name)
  }
  if (loose.length === 0) return
  const destDir = join(root, 'Library')
  await mkdir(destDir, { recursive: true })
  for (const name of loose) {
    let dest = join(destDir, name)
    let n = 2
    const ext = extname(name)
    const stem = basename(name, ext)
    while (existsSync(dest)) {
      dest = join(destDir, `${stem} ${n}${ext}`)
      n += 1
    }
    await rename(join(root, name), dest)
  }
}

async function filesIn(folderPath: string): Promise<MediaLibraryItem[]> {
  const names = await readdir(folderPath).catch(() => [] as string[])
  const items: MediaLibraryItem[] = []
  for (const name of names) {
    const kind = kindFor(name)
    if (!kind) continue
    const path = join(folderPath, name)
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) continue
    items.push({ name, path, kind, size: info.size, modifiedMs: info.mtimeMs })
  }
  return items
}

async function ensureDefaultFolders(): Promise<void> {
  const root = mediaRoot()
  await mkdir(root, { recursive: true })
  for (const name of DEFAULT_FOLDERS) {
    await mkdir(join(root, name), { recursive: true })
  }
}

function folderRank(name: string): number {
  const index = DEFAULT_FOLDERS.indexOf(name as (typeof DEFAULT_FOLDERS)[number])
  return index === -1 ? DEFAULT_FOLDERS.length : index
}

export async function listMediaFolders(): Promise<MediaFolderInfo[]> {
  await shelveLooseFiles()
  await ensureDefaultFolders()
  const root = mediaRoot()
  const names = await readdir(root)
  const folders: MediaFolderInfo[] = []
  for (const name of names) {
    const folderPath = join(root, name)
    const info = await stat(folderPath).catch(() => null)
    if (!info?.isDirectory()) continue
    const items = await filesIn(folderPath)
    folders.push({ name, itemCount: items.length })
  }
  return folders.sort(
    (a, b) => folderRank(a.name) - folderRank(b.name) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

export async function listMediaInFolder(rawName: string): Promise<MediaLibraryItem[]> {
  const folderPath = resolveFolder(rawName)
  if (!folderPath || !existsSync(folderPath)) return []
  return filesIn(folderPath)
}

export async function createMediaFolder(
  rawName: string
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const name = sanitizeFolderName(rawName)
  if (!name) return { ok: false, message: 'Enter a folder name without special characters.' }
  const folderPath = resolveFolder(name)
  if (!folderPath) return { ok: false, message: 'That folder name cannot be used.' }
  const root = mediaRoot()
  await mkdir(root, { recursive: true })
  const existing = await readdir(root).catch(() => [] as string[])
  if (existing.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: 'A folder with that name already exists.' }
  }
  await mkdir(folderPath)
  return { ok: true, name }
}

async function uniqueDestination(folderPath: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const stem = basename(fileName, ext).replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').trim() || 'media'
  let candidate = join(folderPath, `${stem}${ext.toLowerCase()}`)
  let n = 2
  while (existsSync(candidate)) {
    candidate = join(folderPath, `${stem} ${n}${ext.toLowerCase()}`)
    n += 1
  }
  return candidate
}

export async function importMediaIntoFolder(rawName: string): Promise<MediaLibraryItem[] | { ok: false; message: string }> {
  const folderPath = resolveFolder(rawName)
  if (!folderPath || !existsSync(folderPath)) return { ok: false, message: 'Choose a folder first.' }
  const res = await dialog.showOpenDialog({
    title: 'Add media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video and audio', extensions: ['mp4', 'webm', 'mov', 'm4v', 'mp3', 'm4a', 'wav', 'ogg'] }
    ]
  })
  if (res.canceled || res.filePaths.length === 0) return []
  const added: MediaLibraryItem[] = []
  for (const source of res.filePaths) {
    const kind = kindFor(source)
    if (!kind || !existsSync(source)) continue
    const dest = await uniqueDestination(folderPath, basename(source))
    if (!isPathUnderRoot(dest, folderPath)) continue
    await copyFile(source, dest)
    const info = await stat(dest)
    added.push({ name: basename(dest), path: dest, kind, size: info.size, modifiedMs: info.mtimeMs })
  }
  return added
}

export async function removeMediaFile(filePath: string): Promise<boolean> {
  const root = mediaRoot()
  if (!existsSync(filePath) || !isPathUnderRoot(filePath, root)) return false
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile()) return false
  await rm(filePath)
  return true
}
