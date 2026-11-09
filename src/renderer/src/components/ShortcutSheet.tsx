import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { AppIcon } from './AppIcon'
import { Kbd, KbdIcon } from './Kbd'

type ShortcutRow = {
  label: string
  keys: ReactNode
}

type ShortcutGroup = {
  title: string
  rows: ShortcutRow[]
}

const groups: ShortcutGroup[] = [
  {
    title: 'General',
    rows: [{ label: 'Keyboard shortcuts', keys: <Kbd>?</Kbd> }]
  },
  {
    title: 'Service order',
    rows: [
      {
        label: 'Previous or next image',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" />
          </>
        )
      },
      {
        label: 'Previous or next folder',
        keys: (
          <>
            <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" />
          </>
        )
      },
      { label: 'Play or pause', keys: <Kbd>Space</Kbd> },
      { label: 'Send to outputs', keys: <Kbd>Enter</Kbd> },
      {
        label: 'Project or stop',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
          </>
        )
      }
    ]
  },
  {
    title: 'Bible',
    rows: [
      {
        label: 'Previous or next book',
        keys: (
          <>
            <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" />
          </>
        )
      },
      {
        label: 'Previous or next verse',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" />
          </>
        )
      },
      { label: 'Send to outputs', keys: <Kbd>Enter</Kbd> },
      {
        label: 'Cross references',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Shift</Kbd>
          </>
        )
      }
    ]
  },
  {
    title: 'Hymns',
    rows: [
      {
        label: 'Previous or next slide',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> <KbdIcon name="caretUp" />{' '}
            <KbdIcon name="caretDown" />
          </>
        )
      },
      { label: 'Send to outputs', keys: <Kbd>Enter</Kbd> },
      {
        label: 'Project or stop',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
          </>
        )
      }
    ]
  },
  {
    title: 'Presentation',
    rows: [
      {
        label: 'Previous or next slide',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> <KbdIcon name="caretUp" />{' '}
            <KbdIcon name="caretDown" />
          </>
        )
      },
      { label: 'Project the current slide', keys: <Kbd>Enter</Kbd> },
      {
        label: 'Send to outputs',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
          </>
        )
      }
    ]
  },
  {
    title: 'Dictionary',
    rows: [
      {
        label: 'Previous or next entry',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> <KbdIcon name="caretUp" />{' '}
            <KbdIcon name="caretDown" />
          </>
        )
      },
      { label: 'Send to outputs', keys: <Kbd>Enter</Kbd> },
      {
        label: 'Send to outputs or stop',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
          </>
        )
      }
    ]
  },
  {
    title: 'Media',
    rows: [
      {
        label: 'Previous or next folder',
        keys: (
          <>
            <KbdIcon name="caretUp" /> <KbdIcon name="caretDown" />
          </>
        )
      },
      {
        label: 'Previous or next file',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" />
          </>
        )
      },
      { label: 'Play or pause', keys: <Kbd>Space</Kbd> },
      { label: 'Send to outputs', keys: <Kbd>Enter</Kbd> },
      {
        label: 'Send to outputs or stop',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
          </>
        )
      },
      { label: 'Back to the library', keys: <Kbd>Esc</Kbd> }
    ]
  },
  {
    title: 'Presenter view',
    rows: [
      {
        label: 'Previous or next slide',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> <KbdIcon name="caretUp" />{' '}
            <KbdIcon name="caretDown" />
          </>
        )
      },
      { label: 'Close', keys: <Kbd>Esc</Kbd> }
    ]
  },
  {
    title: 'Web',
    rows: [
      {
        label: 'Back or forward',
        keys: (
          <>
            <Kbd>Alt</Kbd> <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" />
          </>
        )
      },
      { label: 'Reload', keys: <Kbd>F5</Kbd> },
      {
        label: 'Send to outputs',
        keys: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
          </>
        )
      }
    ]
  },
  {
    title: 'Sequence',
    rows: [
      {
        label: 'Step the sequence while Follow is on',
        keys: (
          <>
            <KbdIcon name="caretLeft" /> <KbdIcon name="caretRight" /> <KbdIcon name="caretUp" />{' '}
            <KbdIcon name="caretDown" />
          </>
        )
      }
    ]
  }
]

const CLOSE_MS = 200

export function ShortcutSheet({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  const finishUnmount = useCallback(() => {
    const el = dialogRef.current
    if (el?.open) el.close()
    closingRef.current = false
    setMounted(false)
    setVisible(false)
  }, [])

  const beginClose = useCallback(
    (notifyParent = true) => {
      if (closingRef.current) return
      closingRef.current = true
      setVisible(false)
      if (notifyParent) onClose()
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = window.setTimeout(finishUnmount, CLOSE_MS)
    },
    [finishUnmount, onClose]
  )

  useEffect(() => {
    if (open) {
      window.clearTimeout(closeTimerRef.current)
      closingRef.current = false
      setMounted(true)
      return
    }
    if (mounted && visible) beginClose(false)
  }, [open, mounted, visible, beginClose])

  useEffect(() => {
    if (!mounted) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(raf)
      if (el.open) el.close()
    }
  }, [mounted])

  useEffect(
    () => () => {
      window.clearTimeout(closeTimerRef.current)
    },
    []
  )

  if (!mounted) return null

  const onDialogClick = (event: MouseEvent<HTMLDialogElement>): void => {
    if (event.target === event.currentTarget) beginClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={visible ? 'shortcut-sheet shortcut-sheet--visible' : 'shortcut-sheet shortcut-sheet--closing'}
      aria-labelledby="shortcut-sheet-title"
      onClick={onDialogClick}
      onCancel={(event) => {
        event.preventDefault()
        beginClose()
      }}
    >
      <div className="shortcut-sheet__frame" onClick={(event) => event.stopPropagation()}>
        <header className="shortcut-sheet__header">
          <h2 id="shortcut-sheet-title" className="shortcut-sheet__title">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className="adw-button adw-button--flat adw-button--icon-sm"
            aria-label="Close"
            onClick={() => beginClose()}
          >
            <AppIcon name="close" size={16} />
          </button>
        </header>
        <div className="shortcut-sheet__body">
          {groups.map((group) => (
            <section key={group.title} className="shortcut-sheet__group">
              <h3 className="adw-section-label">{group.title}</h3>
              <ul className="shortcut-sheet__list">
                {group.rows.map((row) => (
                  <li key={row.label} className="shortcut-sheet__row">
                    <span>{row.label}</span>
                    <span className="shortcut-sheet__keys">{row.keys}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
