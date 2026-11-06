/** Mount point for overlays that must appear above `dialog.showModal()` content. */
export function getModalPortalRoot(): HTMLElement {
  return (
    document.getElementById('orion-settings-portal') ??
    document.querySelector('.settings-dialog') ??
    document.body
  )
}
