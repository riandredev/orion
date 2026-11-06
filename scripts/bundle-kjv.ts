/**
 * One-off maintainer script: fetch KJV from helloao and write bibles/eng-kjv/.
 * Run: npx tsx scripts/bundle-kjv.ts
 */
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseHelloAoSimpleComplete } from '../src/shared/bible-helloao'

const CATALOG_ID = 'eng_kjv'
const BIBLE_ID = 'eng-kjv'
const ROOT = join(import.meta.dirname, '..', 'bibles', BIBLE_ID)

async function main(): Promise<void> {
  const url = `https://bible.helloao.org/api/${CATALOG_ID}/complete.simple.json`
  const raw = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Fetch failed: ${r.status}`)
    return r.json()
  })

  const module = parseHelloAoSimpleComplete(raw)
  if (CATALOG_ID === 'eng_kjv') {
    module.abbr = 'KJV'
  }
  await mkdir(ROOT, { recursive: true })

  await writeFile(join(ROOT, 'module.json'), JSON.stringify(module))
  await writeFile(
    join(ROOT, 'meta.json'),
    JSON.stringify(
      {
        id: BIBLE_ID,
        label: module.label,
        abbr: module.abbr,
        format: 'orion-json',
        sourceName: `${CATALOG_ID}.helloao.json`,
        importedAt: new Date().toISOString(),
        catalogSourceId: CATALOG_ID
      },
      null,
      2
    )
  )

  console.log(`Wrote ${BIBLE_ID} (${Object.keys(module.books).length} books) to ${ROOT}`)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
