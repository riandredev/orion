import { execFileSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'

const id = process.argv[2] ?? 'panorama'
const manifestPath = join('bundles', id, 'manifest.json')
const packPath = join('bundles', id, 'pack.json')
if (!existsSync(manifestPath) || !existsSync(packPath)) {
  console.error(`Add bundles/${id}/manifest.json and bundles/${id}/pack.json, then list the library in bundles/catalog.json.`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const include = pack.include
if (!Array.isArray(include) || include.length === 0) {
  console.error(`bundles/${id}/pack.json needs an include list of [from, to] paths.`)
  process.exit(1)
}

const stage = join('dist', 'bundles', 'stage', id)
const out = join('dist', 'bundles', `Orion-Bundle-${id}-${manifest.version}.zip`)

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
cpSync(manifestPath, join(stage, 'manifest.json'))

for (const entry of include) {
  if (!Array.isArray(entry) || entry.length < 1 || entry.some((part) => typeof part !== 'string')) {
    console.error(`Invalid include entry in bundles/${id}/pack.json.`)
    process.exit(1)
  }
  const from = entry[0]
  const to = entry[1] ?? entry[0]
  mkdirSync(join(stage, to, '..'), { recursive: true })
  cpSync(from, join(stage, to), { recursive: true })
}

mkdirSync(join('dist', 'bundles'), { recursive: true })
execFileSync('tar', ['-a', '-cf', out, '-C', stage, '.'], { stdio: 'inherit' })
console.log(out)
