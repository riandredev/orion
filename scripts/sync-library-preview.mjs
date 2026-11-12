import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { dirname, extname, join, relative } from 'path'

const id = 'panorama'
const check = process.argv.includes('--check')
const imageExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const previewRoot = join('bundles', id, 'preview')
const manifest = JSON.parse(readFileSync(join('bundles', id, 'manifest.json'), 'utf8'))
const catalogPath = join('bundles', 'catalog.json')
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const entry = catalog.bundles.find((item) => item.id === id)
if (!entry) {
  console.error('Panorama is missing from bundles/catalog.json')
  process.exit(1)
}

function compareNames(a, b) {
  const order = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  return manifest.orderFolderSort === 'za' ? -order : order
}

function listImages(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => imageExt.has(extname(name).toLowerCase()) && statSync(join(dir, name)).isFile())
    .sort(compareNames)
}

async function writePreview(src, dest) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas')
  const image = await loadImage(src)
  const canvas = createCanvas(480, 270)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, 480, 270)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, canvas.toBuffer('image/jpeg', 75))
}

const folders = existsSync('order-images')
  ? readdirSync('order-images')
      .filter((name) => statSync(join('order-images', name)).isDirectory())
      .sort(compareNames)
  : []

const serviceImages = []
for (const folder of folders) {
  for (const file of listImages(join('order-images', folder))) {
    const previewName = `${file.slice(0, file.lastIndexOf('.'))}.jpg`
    serviceImages.push({
      folder,
      src: `preview/order/${folder}/${previewName}`,
      alt: `${folder} slide`,
      from: join('order-images', folder, file)
    })
  }
}

const backgroundSources = [
  ['Bible', 'images/bible-image.jpg', 'preview/backgrounds/bible.jpg'],
  ['Hymn', 'images/hymn-image.jpg', 'preview/backgrounds/hymn.jpg']
].filter(([, src]) => existsSync(src))

const backgroundImages = backgroundSources.map(([label, from, src]) => ({
  src,
  alt: `${label} background`,
  from
}))

const kept = (entry.preview ?? []).filter((group) => group.label !== 'Service order' && group.label !== 'Backgrounds')
const preview = [
  {
    label: 'Service order',
    items: folders,
    images: serviceImages.map(({ folder, src, alt }) => ({ folder, src, alt }))
  },
  ...kept,
  {
    label: 'Backgrounds',
    items: backgroundSources.map(([label]) => label),
    images: backgroundImages.map(({ src, alt }) => ({ src, alt }))
  }
]

function expectedFiles() {
  return [...serviceImages, ...backgroundImages].map((image) => image.src.replaceAll('\\', '/'))
}

function filesUnder(dir, prefix) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) out.push(...filesUnder(abs, `${prefix}/${name}`))
    else if (extname(name).toLowerCase() === '.jpg') out.push(`${prefix}/${name}`.replaceAll('\\', '/'))
  }
  return out
}

if (check) {
  const wanted = expectedFiles().sort()
  const listed = (entry.preview ?? [])
    .flatMap((group) => group.images ?? [])
    .map((image) => image.src)
    .sort()
  const onDisk = [...filesUnder(join(previewRoot, 'order'), 'preview/order'), ...filesUnder(join(previewRoot, 'backgrounds'), 'preview/backgrounds')].sort()
  const same = (left, right) => left.length === right.length && left.every((item, index) => item === right[index])
  const catalogImages = JSON.stringify(entry.preview ?? [])
  const nextImages = JSON.stringify(preview)
  if (!same(wanted, listed) || !same(wanted, onDisk) || catalogImages !== nextImages) {
    console.error('Library preview is behind the pack. Run: node scripts/sync-library-preview.mjs')
    process.exit(1)
  }
  console.log('Library preview matches the pack.')
  process.exit(0)
}

const written = new Set()
for (const image of [...serviceImages, ...backgroundImages]) {
  const dest = join('bundles', id, image.src)
  written.add(relative(previewRoot, dest).replaceAll('\\', '/'))
  await writePreview(image.from, dest)
}

for (const folder of ['order', 'backgrounds']) {
  const root = join(previewRoot, folder)
  if (!existsSync(root)) continue
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) {
        walk(abs)
        if (readdirSync(abs).length === 0) rmSync(abs, { recursive: true })
        continue
      }
      const rel = relative(previewRoot, abs).replaceAll('\\', '/')
      if (!written.has(rel)) rmSync(abs)
    }
  }
  walk(root)
}

entry.preview = preview
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Updated ${serviceImages.length} slide previews and ${backgroundImages.length} backgrounds.`)
