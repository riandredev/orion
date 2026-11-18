/** True when a Music-folder file is an .mp3 named only with this hymn's number (1.mp3, 001.mp3, …). */
export function hymnMusicFileMatches(fileName: string, hymnNumber: number): boolean {
  if (!Number.isFinite(hymnNumber) || hymnNumber <= 0) return false
  if (!/\.mp3$/i.test(fileName)) return false
  const stem = fileName.replace(/\.mp3$/i, '')
  if (!/^\d+$/.test(stem)) return false
  return Number(stem) === hymnNumber
}

export function pickHymnMusicPath(
  files: readonly { name: string; path: string }[],
  hymnNumber: number
): string | null {
  const match = files.find((file) => hymnMusicFileMatches(file.name, hymnNumber))
  return match?.path ?? null
}
