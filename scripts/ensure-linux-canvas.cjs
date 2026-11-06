const { execFileSync } = require('child_process')
const { existsSync, mkdirSync, renameSync, rmSync } = require('fs')
const { join } = require('path')

const dest = join('node_modules', '@napi-rs', 'canvas-linux-x64-gnu')
if (existsSync(join(dest, 'package.json'))) {
  process.exit(0)
}

const packed = execFileSync('npm', ['pack', '@napi-rs/canvas-linux-x64-gnu@1.1.0'], {
  encoding: 'utf8'
})
  .trim()
  .split(/\r?\n/)
  .pop()

mkdirSync(join('node_modules', '@napi-rs'), { recursive: true })
const parent = join('node_modules', '@napi-rs')
execFileSync('tar', ['-xzf', packed, '-C', parent], { stdio: 'inherit' })
const extracted = join(parent, 'package')
if (!existsSync(extracted)) {
  throw new Error('Linux canvas package did not extract')
}
rmSync(dest, { recursive: true, force: true })
renameSync(extracted, dest)
rmSync(packed, { force: true })
console.log('Installed @napi-rs/canvas-linux-x64-gnu for the Linux installer')
