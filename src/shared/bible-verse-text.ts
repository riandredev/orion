/** Edition markers that should not appear in on-screen verse text. */
export function normalizeVerseDisplayText(text: string): string {
  return text.replace(/^\u00B6+\s*/u, '').trimStart()
}
