const { execFileSync } = require('child_process')
const { existsSync, mkdirSync, renameSync, rmSync } = require('fs')
const { join } = require('path')

function run(command, args, options = {}) {
  const file = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command
  return execFileSync(file, args, { ...options, shell: process.platform === 'win32' })
}

const dest = join('node_modules', '@napi-rs', 'canvas-linux-x64-gnu')
if (existsSync(join(dest, 'package.json'))) {
  process.exit(0)
}

const packed = run('npm', ['pack', '@napi-rs/canvas-linux-x64-gnu@1.1.0'], {
  encoding: 'utf8'
})
  .trim()
  .split(/\r?\n/)
  .pop()

mkdirSync(join('node_modules', '@napi-rs'), { recursive: true })
const parent = join('node_modules', '@napi-rs')
run('tar', ['-xzf', packed, '-C', parent], { stdio: 'inherit' })
const extracted = join(parent, 'package')
if (!existsSync(extracted)) {
  throw new Error('Linux canvas package did not extract')
}
rmSync(dest, { recursive: true, force: true })
renameSync(extracted, dest)
rmSync(packed, { force: true })
console.log('Installed @napi-rs/canvas-linux-x64-gnu for the Linux installer')
