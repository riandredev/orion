import { execFileSync } from 'child_process'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'

const id = process.argv[2] ?? 'panorama'
const manifest = JSON.parse(readFileSync(join('bundles', id, 'manifest.json'), 'utf8'))
const stage = join('dist', 'bundles', 'stage', id)
const out = join('dist', 'bundles', `Orion-Bundle-${id}-${manifest.version}.zip`)

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
cpSync(join('bundles', id, 'manifest.json'), join(stage, 'manifest.json'))

const copies = [
  ['order-images', 'order-images'],
  ['hymnals/adventist-1-afrikaans', 'hymnals/adventist-1-afrikaans'],
  ['hymnals/adventist-2-english-new', 'hymnals/adventist-2-english-new'],
  ['bibles/eng-kjv', 'bibles/eng-kjv'],
  ['bibles/bss-afri', 'bibles/bss-afri'],
  ['images/bible-image.jpg', 'images/bible-image.jpg'],
  ['images/bible-image.png', 'images/bible-image.png'],
  ['images/hymn-image.jpg', 'images/hymn-image.jpg']
]

for (const [from, to] of copies) {
  mkdirSync(join(stage, to, '..'), { recursive: true })
  cpSync(from, join(stage, to), { recursive: true })
}

mkdirSync(join('dist', 'bundles'), { recursive: true })
execFileSync('tar', ['-a', '-cf', out, '-C', stage, '.'], { stdio: 'inherit' })
console.log(out)
