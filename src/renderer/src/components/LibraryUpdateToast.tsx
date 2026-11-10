import { useState, type ReactElement } from 'react'
import { AppIcon } from './AppIcon'

type LibraryUpdateToastProps = {
  count: number
  onOpen: () => void
  progress: { percent: number } | null
}

export function LibraryUpdateToast({ count, onOpen, progress }: LibraryUpdateToastProps): ReactElement | null {
  const [dismissedCount, setDismissedCount] = useState(0)
  if (progress) {
    const percent = Math.min(100, Math.max(0, Math.round(progress.percent)))
    return (
      <div className="library-toast library-toast--progress" role="status">
        <p>Updating libraries</p>
        <span
          className="adw-progress-bar"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="adw-progress-bar__fill" style={{ width: `${percent}%` }} />
        </span>
      </div>
    )
  }
  if (count <= 0 || count <= dismissedCount) return null
  const label = count === 1 ? '1 library update' : `${count} library updates`

  return (
    <div className="library-toast" role="status">
      <p>{label}</p>
      <button
        type="button"
        className="adw-button adw-button--suggested"
        onClick={() => {
          setDismissedCount(count)
          onOpen()
        }}
      >
        View
      </button>
      <button
        type="button"
        className="adw-button adw-button--flat adw-button--icon-sm"
        aria-label="Dismiss"
        onClick={() => setDismissedCount(count)}
      >
        <AppIcon name="close" size={16} />
      </button>
    </div>
  )
}
