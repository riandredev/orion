import type { ReactElement } from 'react'
import type {
  PresentationImportDepsProgress,
  PresentationImportDepsStatus
} from '../../../shared/presentation-import-deps'
import { PRESENTATION_IMPORT_DEPS_DISK_SIZE_HINT } from '../../../shared/presentation-import-deps'

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export type PresentationImportDepsEmptyStateProps = {
  status: PresentationImportDepsStatus
  progress: PresentationImportDepsProgress | null
  downloading: boolean
  onDownload: () => void
  onCancel: () => void
}

/** AdwStatusPage-style empty state for the main stage (no sidebar chrome). */
export function PresentationImportDepsEmptyState({
  status,
  progress,
  downloading,
  onDownload,
  onCancel
}: PresentationImportDepsEmptyStateProps): ReactElement {
  const active =
    progress &&
    (progress.phase === 'downloading' ||
      progress.phase === 'installing' ||
      progress.phase === 'extracting' ||
      progress.phase === 'pruning' ||
      progress.phase === 'verifying')

  const showIndeterminate = active && progress?.percent === undefined

  const progressCaption = (() => {
    if (!progress) return undefined
    if (
      progress.phase === 'downloading' &&
      progress.receivedBytes !== undefined &&
      progress.totalBytes
    ) {
      const pct =
        progress.percent !== undefined ? ` · ${progress.percent}%` : ''
      return `${formatBytes(progress.receivedBytes)} / ${formatBytes(progress.totalBytes)}${pct}`
    }
    if (progress.message && progress.percent !== undefined) {
      return `${progress.message} · ${progress.percent}%`
    }
    return progress.message
  })()

  return (
    <div className="presentation-stage-empty" role="region" aria-label="Presentation import setup">
      <div className="presentation-stage-empty__inner">
        <h2 className="presentation-stage-empty__title adw-title-2">Download dependencies</h2>
        <p className="presentation-stage-empty__desc adw-caption">
          {status.onDemandAvailable ? (
            <>
              Import PowerPoint and Keynote files after a one-time install (
              {status.downloadSizeHint ?? 'large download'}; {PRESENTATION_IMPORT_DEPS_DISK_SIZE_HINT}
              ). On Windows this uses winget to install LibreOffice (a UAC prompt may appear).
            </>
          ) : (
            (status.helpText ??
              'Install LibreOffice from libreoffice.org, or export PDF from PowerPoint.')
          )}
        </p>

        {active ? (
          <div className="presentation-stage-empty__progress" role="status" aria-live="polite">
            <div className="presentation-stage-empty__progress-meta">
              {showIndeterminate ? <span className="adw-spinner adw-spinner--sm" aria-hidden /> : null}
              <span className="adw-caption">{progressCaption}</span>
            </div>
            <div
              className={
                showIndeterminate
                  ? 'adw-progress-bar adw-progress-bar--presentation adw-progress-bar--indeterminate'
                  : 'adw-progress-bar adw-progress-bar--presentation'
              }
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={showIndeterminate ? undefined : progress?.percent}
            >
              {!showIndeterminate ? (
                <span
                  className="adw-progress-bar__fill"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              ) : null}
            </div>
            <button type="button" className="adw-button adw-button--flat" onClick={onCancel}>
              Cancel download
            </button>
          </div>
        ) : (
          <div className="presentation-stage-empty__actions">
            {progress?.phase === 'error' ? (
              <p className="presentation-stage-empty__error adw-caption">{progress.message}</p>
            ) : null}
            {status.onDemandAvailable ? (
              <button
                type="button"
                className="adw-button adw-button--suggested"
                onClick={onDownload}
                disabled={downloading}
              >
                Download dependencies
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
