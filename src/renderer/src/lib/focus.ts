/** Drop the focus a dialog hands back to its opener, so the ring and tooltip stay hidden. */
export function clearRestoredDialogFocus(): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return
  active.blur()
}

/** Arrow-key shortcuts should move content, not light up the focused button. */
export function blurShortcutTarget(target: EventTarget | null): void {
  const el = target instanceof HTMLElement ? target : null
  if (!el || el === document.body) return
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
  el.blur()
}
