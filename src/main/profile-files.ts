import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'

export async function exportProfileFileToDialog(
  json: string,
  suggestedName: string
): Promise<string | null> {
  const res = await dialog.showSaveDialog({
    title: 'Export Orion profile',
    defaultPath: suggestedName.endsWith('.orionprofile')
      ? suggestedName
      : `${suggestedName}.orionprofile`,
    filters: [
      { name: 'Orion profile', extensions: ['orionprofile'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  })
  if (res.canceled || !res.filePath) return null
  await writeFile(res.filePath, json, 'utf8')
  return res.filePath
}

export async function importProfileFileFromDialog(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import Orion profile',
    properties: ['openFile'],
    filters: [
      { name: 'Orion profile', extensions: ['orionprofile', 'json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths[0]) return null
  return readFile(res.filePaths[0], 'utf8')
}
