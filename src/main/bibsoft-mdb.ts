import { readFile } from 'fs/promises'
import MDBReader from 'mdb-reader'
import {
  convertBibsoftDatabase,
  type BibsoftHymnalBundle,
  type BibsoftHymnalRow,
  type BibsoftHymnStanzaRow
} from '../shared/bibsoft-hymnal-convert'

function pickRowFields<T extends Record<string, unknown>>(row: Record<string, unknown>, keys: (keyof T)[]): T {
  const out = {} as T
  for (const key of keys) {
    out[key] = row[key as string] as T[keyof T]
  }
  return out
}

export async function readBibsoftMdbFile(
  filePath: string,
  hymnalIdFor?: (bibsoftHymnalId: number, label: string) => string
): Promise<BibsoftHymnalBundle[]> {
  const buffer = await readFile(filePath)
  return readBibsoftMdbBuffer(buffer, hymnalIdFor)
}

export function readBibsoftMdbBuffer(
  buffer: Buffer,
  hymnalIdFor: (bibsoftHymnalId: number, label: string) => string = defaultImportedHymnalId
): BibsoftHymnalBundle[] {
  const reader = new MDBReader(buffer)
  const hymnalTable = reader.getTable('Hymnals')
  const hymnsTable = reader.getTable('Hymns')
  if (!hymnalTable || !hymnsTable) {
    throw new Error('Not a Bibsoft Adventist hymnal database (expected Hymnals and Hymns tables)')
  }

  const hymnalRows = hymnalTable.getData().map((row) =>
    pickRowFields<BibsoftHymnalRow>(row, ['ID', 'Hymnal'])
  )
  const stanzaRows = hymnsTable.getData().map((row) =>
    pickRowFields<BibsoftHymnStanzaRow>(row, [
      'Hymnal',
      'HymnNumber',
      'HymnName',
      'VerseNumber',
      'VerseText',
      'Author'
    ])
  )

  return convertBibsoftDatabase(hymnalIdFor, hymnalRows, stanzaRows)
}

export function defaultImportedHymnalId(bibsoftHymnalId: number, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return `bibsoft-${bibsoftHymnalId}-${slug || 'hymnal'}-${Date.now().toString(36)}`
}

export function stableBundledHymnalId(bibsoftHymnalId: number, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `adventist-${bibsoftHymnalId}-${slug || 'hymnal'}`
}
