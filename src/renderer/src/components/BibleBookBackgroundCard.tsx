import type { ReactElement } from 'react'
import { bibleBooks, getBookDisplayName } from '../../../shared/bible-books'
import { isAfrikaansBibleTranslation } from '../../../shared/bible-book-names-af'
import { findInstalledBible, loadBibleTranslation } from '../data/bible-translations'
import { setBibleBookBackground, useBibleBookBackgrounds } from '../lib/bible-book-backgrounds'
import { useInstalledBibles } from '../lib/use-installed-bibles'
import { AdwSelect } from './AdwSelect'

export function BibleBookBackgroundCard({
  bookId,
  onBookId,
  assignedName
}: {
  bookId: string
  onBookId: (bookId: string) => void
  assignedName: string | null
}): ReactElement {
  const { bibles } = useInstalledBibles()
  const assignments = useBibleBookBackgrounds()
  const translation = findInstalledBible(bibles, loadBibleTranslation())
  const afrikaans = isAfrikaansBibleTranslation(translation)
  const bookName = getBookDisplayName(bookId, afrikaans)

  return (
    <>
      <div className="settings-bg__section-head">
        <h3 className="settings-bg__subtitle">Book backgrounds</h3>
        <p className="adw-caption">
          Choose a book, then click an image in the library. Books without their own image keep the Bible background.
        </p>
      </div>
      <div className="settings-bg__form">
        <div className="settings-bg__field">
          <span className="settings-field__label">Book</span>
          <AdwSelect
            value={bookId}
            aria-label="Bible book"
            options={bibleBooks.map((book) => ({
              value: book.id,
              label: assignments[book.id]
                ? `${getBookDisplayName(book.id, afrikaans)} · own image`
                : getBookDisplayName(book.id, afrikaans)
            }))}
            onChange={onBookId}
          />
        </div>
        <div className="settings-bg__field">
          <p className="adw-caption settings-bg__book-status">
            {assignedName ? `${bookName} uses ${assignedName}.` : `${bookName} uses the Bible background.`}
          </p>
        </div>
        {assignedName ? (
          <button
            type="button"
            className="adw-button adw-button--flat"
            onClick={() => setBibleBookBackground(bookId, null)}
          >
            Use Bible background
          </button>
        ) : null}
      </div>
    </>
  )
}
