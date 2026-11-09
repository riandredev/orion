const { execFileSync } = require('child_process')
const { existsSync, mkdirSync, renameSync, rmSync } = require('fs')
const { join } = require('path')

function run(command, args, options = {}) {
  const file = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command
  return execFileSync(file, args, { ...options, shell: process.platform === 'win32' })
}

const packages = ['@napi-rs/canvas-darwin-arm64@1.1.0', '@napi-rs/canvas-darwin-x64@1.1.0']

for (const spec of packages) {
  const name = spec.slice(0, spec.lastIndexOf('@'))
  const dest = join('node_modules', '@napi-rs', name.slice('@napi-rs/'.length))
  if (existsSync(join(dest, 'package.json'))) continue

  const packed = run('npm', ['pack', spec], { encoding: 'utf8' }).trim().split(/\r?\n/).pop()
  mkdirSync(join('node_modules', '@napi-rs'), { recursive: true })
  const parent = join('node_modules', '@napi-rs')
  run('tar', ['-xzf', packed, '-C', parent], { stdio: 'inherit' })
  const extracted = join(parent, 'package')
  if (!existsSync(extracted)) {
    throw new Error(`${name} did not extract`)
  }
  rmSync(dest, { recursive: true, force: true })
  renameSync(extracted, dest)
  rmSync(packed, { force: true })
  console.log(`Installed ${name} for the macOS installer`)
}
