import type { PresentationImportDepsStatus } from '../../../shared/presentation-import-deps'

export async function fetchPresentationImportDepsStatus(): Promise<PresentationImportDepsStatus> {
  return window.orion.getPresentationImportDepsStatus()
}

export async function downloadPresentationImportDeps(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  return window.orion.downloadPresentationImportDeps()
}

export function cancelPresentationImportDepsDownload(): void {
  void window.orion.cancelPresentationImportDepsDownload()
}

export function subscribePresentationImportDepsProgress(
  callback: (progress: import('../../../shared/presentation-import-deps').PresentationImportDepsProgress) => void
): () => void {
  return window.orion.onPresentationImportDepsProgress(callback)
}
