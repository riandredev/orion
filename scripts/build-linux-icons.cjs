const { createCanvas, loadImage } = require('@napi-rs/canvas')
const { mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const outDir = join('build', 'icons')

async function main() {
  const source = await loadImage(join('build', 'icon.png'))
  mkdirSync(outDir, { recursive: true })
  for (const size of sizes) {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0, size, size)
    writeFileSync(join(outDir, `${size}x${size}.png`), canvas.toBuffer('image/png'))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
