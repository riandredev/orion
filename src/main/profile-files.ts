import { app, dialog } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import { path7za } from '7zip-bin'
import { biblesRoot, imagesRoot, mediaRoot, orderImagesRoot, presentationsRoot } from './paths'

function bundlesDir(): string {
  return join(app.getPath('userData'), 'bundles')
}

/** Library install records. The downloaded zip files stay out; the content itself is packed separately. */
async function stageLibraryRecords(stage: string): Promise<void> {
  const dir = bundlesDir()
  if (!existsSync(dir)) return
  const dest = join(stage, 'bundles')
  const names = await readdir(dir)
  for (const name of names) {
    if (!name.endsWith('.json') || name.includes('..')) continue
    const src = join(dir, name)
    const info = await stat(src)
    if (!info.isFile()) continue
    await mkdir(dest, { recursive: true })
    await cp(src, join(dest, name))
  }
}

function contentDirectories(): { name: string; dir: string }[] {
  return [
    { name: 'hymnals', dir: join(app.getPath('userData'), 'hymnals') },
    { name: 'bibles', dir: biblesRoot() },
    { name: 'presentations', dir: presentationsRoot() },
    { name: 'media', dir: mediaRoot() },
    { name: 'order-images', dir: orderImagesRoot() },
    { name: 'images', dir: imagesRoot() },
    { name: 'dictionary', dir: join(app.getPath('userData'), 'dictionary') }
  ]
}

function run7za(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(path7za, args, { cwd, windowsHide: true })
    let errorText = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      errorText += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(errorText.trim() || `Could not pack the profile (${code ?? 'unknown'})`))
    })
  })
}

async function writeContentPack(json: string, dest: string): Promise<void> {
  const stage = await mkdtemp(join(tmpdir(), 'orion-profile-'))
  try {
    await writeFile(join(stage, 'profile.orionprofile'), json, 'utf8')
    await stageLibraryRecords(stage)
    if (existsSync(dest)) await rm(dest, { force: true })
    await run7za(['a', '-tzip', '-mx=0', '-y', dest, 'profile.orionprofile'], stage)
    if (existsSync(join(stage, 'bundles'))) {
      await run7za(['a', '-tzip', '-mx=0', '-y', dest, 'bundles'], stage)
    }
    for (const entry of contentDirectories()) {
      if (!existsSync(entry.dir)) continue
      await run7za(['a', '-tzip', '-mx=0', '-y', dest, basename(entry.dir)], dirname(entry.dir))
    }
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

async function copyDirectoryInto(src: string, dest: string): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true })
  await mkdirSafe(dest)
  for (const entry of entries) {
    await cp(join(src, entry.name), join(dest, entry.name), { recursive: true, force: true })
  }
}

async function mkdirSafe(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function installContentPack(bytes: Buffer): Promise<string | null> {
  const stage = await mkdtemp(join(tmpdir(), 'orion-profile-'))
  const archive = join(stage, 'pack.zip')
  try {
    await writeFile(archive, bytes)
    const extracted = join(stage, 'out')
    await run7za(['x', archive, `-o${extracted}`, '-y'], stage)
    const profilePath = join(extracted, 'profile.orionprofile')
    if (!existsSync(profilePath)) return null
    const json = await readFile(profilePath, 'utf8')
    const packedRoots = [...contentDirectories(), { name: 'bundles', dir: bundlesDir() }]
    for (const entry of packedRoots) {
      const packed = join(extracted, entry.name)
      if (!existsSync(packed)) continue
      await copyDirectoryInto(packed, entry.dir)
    }
    return json
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

export async function exportProfileFileToDialog(
  json: string,
  suggestedName: string,
  includeContent = false
): Promise<string | null> {
  const base = suggestedName.replace(/\.(orionprofile|orionpack)$/i, '')
  const res = await dialog.showSaveDialog({
    title: includeContent ? 'Export Orion profile and content' : 'Export Orion profile',
    defaultPath: includeContent ? `${base}.orionpack` : `${base}.orionprofile`,
    filters: includeContent
      ? [{ name: 'Orion profile with content', extensions: ['orionpack'] }]
      : [
          { name: 'Orion profile', extensions: ['orionprofile'] },
          { name: 'JSON', extensions: ['json'] }
        ]
  })
  if (res.canceled || !res.filePath) return null
  if (!includeContent) {
    await writeFile(res.filePath, json, 'utf8')
    return res.filePath
  }
  await writeContentPack(json, res.filePath)
  return res.filePath
}

export async function importProfileFileFromDialog(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import Orion profile',
    properties: ['openFile'],
    filters: [
      { name: 'Orion profile', extensions: ['orionprofile', 'orionpack', 'json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  const filePath = res.filePaths[0]
  if (res.canceled || !filePath) return null
  const bytes = await readFile(filePath)
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return installContentPack(bytes)
  }
  return bytes.toString('utf8')
}
