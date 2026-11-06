import { spawn } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const SCRIPT = `
param([string]$Manifest)
Add-Type -AssemblyName System.Drawing
$jobs = Get-Content -Raw -Path $Manifest | ConvertFrom-Json
foreach ($job in $jobs) {
  try {
    $img = [System.Drawing.Image]::FromFile($job.In)
    $w = [Math]::Min(4096, [Math]::Max(1, $img.Width))
    $h = [Math]::Min(4096, [Math]::Max(1, $img.Height))
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($job.Out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
  } catch {
    Write-Error $_
  }
}
`

function runPowerShell(scriptPath: string, manifestPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, manifestPath],
      { windowsHide: true }
    )
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `powershell exited ${code}`))
    })
  })
}

/** EMF/WMF pictures cannot be drawn by Chromium. Rasterize them to PNG. */
export async function rasterizeMetafiles(payloads: Buffer[]): Promise<(Buffer | null)[]> {
  if (payloads.length === 0 || process.platform !== 'win32') return payloads.map(() => null)
  const dir = await mkdtemp(join(tmpdir(), 'orion-emf-'))
  try {
    const jobs = await Promise.all(
      payloads.map(async (payload, index) => {
        const input = join(dir, `${index}.emf`)
        const output = join(dir, `${index}.png`)
        await writeFile(input, payload)
        return { In: input, Out: output }
      })
    )
    const manifest = join(dir, 'jobs.json')
    const script = join(dir, 'rasterize.ps1')
    await writeFile(manifest, JSON.stringify(jobs))
    await writeFile(script, SCRIPT)
    try {
      await runPowerShell(script, manifest)
    } catch {
      return payloads.map(() => null)
    }
    return Promise.all(
      jobs.map(async (job) => {
        try {
          return await readFile(job.Out)
        } catch {
          return null
        }
      })
    )
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
