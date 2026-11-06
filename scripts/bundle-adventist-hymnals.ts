/**
 * One-time bundler: AdventistHymnals.mdb → shipped Orion hymnal folders.
 *
 * Usage: npx tsx scripts/bundle-adventist-hymnals.ts [path-to.mdb]
 */
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { readBibsoftMdbBuffer, stableBundledHymnalId } from '../src/main/bibsoft-mdb'
import type { HymnalHymnsFile, HymnalIndexFile, HymnalMeta } from '../src/shared/hymnal-types'
import { hymnSummaryFromEntry } from '../src/shared/hymnal-summary'

function bundledMeta(id: string, bundle: { label: string; language: HymnalMeta['language']; hymnCount: number }): HymnalMeta {
  if (id === 'adventist-1-afrikaans') {
    return { id, label: 'Afrikaans', abbr: 'Afrikaans', language: 'af', source: 'builtin', hymnCount: bundle.hymnCount }
  }
  if (id === 'adventist-2-english-new') {
    return { id, label: 'English', abbr: 'English', language: 'en', source: 'builtin', hymnCount: bundle.hymnCount }
  }
  return {
    id,
    label: bundle.label,
    abbr: bundle.label.slice(0, 12),
    language: bundle.language,
    source: 'builtin',
    hymnCount: bundle.hymnCount
  }
}

const defaultMdb =
  process.env.ADVENTIST_HYMNALS_MDB ?? 'C:\\Users\\Riandre\\Downloads\\AdventistHymnals.mdb'

async function main(): Promise<void> {
  const mdbPath = process.argv[2] ?? defaultMdb
  const outRoot = join(process.cwd(), 'hymnals')
  const buffer = await readFile(mdbPath)
  const bundles = readBibsoftMdbBuffer(buffer, stableBundledHymnalId)

  for (const bundle of bundles.filter((b) => b.hymns.length >= 10)) {
    const id = stableBundledHymnalId(bundle.bibsoftId, bundle.label)
    const dir = join(outRoot, id)
    await mkdir(dir, { recursive: true })

    const hymns = bundle.hymns.map((h) => ({ ...h, hymnalId: id }))
    const meta = bundledMeta(id, {
      label: bundle.label,
      language: bundle.language,
      hymnCount: hymns.length
    })
    const summaries = hymns.map((h) => hymnSummaryFromEntry(h))

    await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
    await writeFile(join(dir, 'index.json'), JSON.stringify({ summaries } satisfies HymnalIndexFile), 'utf8')
    await writeFile(join(dir, 'hymns.json'), JSON.stringify({ hymns } satisfies HymnalHymnsFile), 'utf8')
    console.log(`Wrote ${id}: ${hymns.length} hymns → ${dir}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
