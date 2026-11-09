import { gzipSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const ABBREV = {
  ge: 1, ex: 2, le: 3, nu: 4, de: 5, jos: 6, jud: 7, ru: 8,
  '1sa': 9, '2sa': 10, '1ki': 11, '2ki': 12, '1ch': 13, '2ch': 14,
  ezr: 15, ne: 16, es: 17, job: 18, ps: 19, pr: 20, ec: 21, so: 22,
  isa: 23, jer: 24, la: 25, eze: 26, exe: 26, da: 27, ho: 28, joe: 29,
  am: 30, ob: 31, jon: 32, mic: 33, na: 34, hab: 35, zep: 36, hag: 37,
  zec: 38, mal: 39, mt: 40, mr: 41, lu: 42, joh: 43, ac: 44, ro: 45,
  '1co': 46, '2co': 47, ga: 48, eph: 49, php: 50, col: 51, '1th': 52,
  '2th': 53, '1ti': 54, '2ti': 55, tit: 56, phm: 57, heb: 58, jas: 59,
  '1pe': 60, '2pe': 61, '1jo': 62, '2jo': 63, '3jo': 64, jude: 65, re: 66
}

function targetsFromList(list) {
  const targets = []
  for (const chunk of list.split(';')) {
    const match = chunk.trim().match(/^([0-9a-z]+)\s+(\d+):(.+)$/i)
    if (!match) continue
    const book = ABBREV[match[1].toLowerCase()]
    if (!book) continue
    const chapter = Number(match[2])
    for (const piece of match[3].split(',')) {
      const range = piece.trim().match(/^(\d+)(?:-(\d+))?$/)
      if (!range) continue
      const verse = Number(range[1])
      const end = range[2] ? Number(range[2]) : 0
      if (!chapter || !verse || (end && end < verse)) continue
      targets.push(end && end !== verse ? `${book}.${chapter}.${verse}-${end}` : `${book}.${chapter}.${verse}`)
    }
  }
  return targets
}

const response = await fetch('https://raw.githubusercontent.com/ariseshinestudio/TSK/master/tskxref.txt')
if (!response.ok) throw new Error(`TSK download failed: ${response.status}`)
const text = await response.text()
const byVerse = new Map()
let skipped = 0
for (const line of text.split(/\r?\n/)) {
  if (!line.trim()) continue
  const parts = line.split('\t')
  const book = Number(parts[0])
  const chapter = Number(parts[1])
  const verse = Number(parts[2])
  if (book < 1 || book > 66 || !chapter || !verse) continue
  const key = `${book}.${chapter}.${verse}`
  const seen = byVerse.get(key) ?? new Set()
  const before = seen.size
  for (const target of targetsFromList(parts[5] ?? '')) seen.add(target)
  if (seen.size === before && (parts[5] ?? '').trim()) skipped += 1
  byVerse.set(key, seen)
}

const data = {}
let refs = 0
let max = 0
for (const [key, seen] of byVerse) {
  if (seen.size === 0) continue
  data[key] = [...seen].join(' ')
  refs += seen.size
  if (seen.size > max) max = seen.size
}

const json = JSON.stringify(data)
const gz = gzipSync(json)
writeFileSync(new URL('../src/shared/bible-cross-refs.json.gz', import.meta.url), gz)
console.log(JSON.stringify({
  verses: Object.keys(data).length,
  refs,
  max,
  genesis1: data['1.1.1']?.split(' ').length ?? 0,
  skipped,
  json: json.length,
  gzip: gz.length
}))
