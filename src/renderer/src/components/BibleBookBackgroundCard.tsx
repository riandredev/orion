import { useEffect, useState, type ReactElement } from 'react'
import { bibleBooks, getBookDisplayName } from '../../../shared/bible-books'
import { isAfrikaansBibleTranslation } from '../../../shared/bible-book-names-af'
import { findInstalledBible, loadBibleTranslation } from '../data/bible-translations'
import type { OrderFolderImage } from '../env'
import { setBibleBookBackground, useBibleBookBackgrounds } from '../lib/bible-book-backgrounds'
import { backgroundImagesMatch } from '../lib/background-settings'
import { useInstalledBibles } from '../lib/use-installed-bibles'
import { AdwSelect } from './AdwSelect'

export function BibleBookBackgroundCard(): ReactElement {
  const { bibles } = useInstalledBibles()
  const assignments = useBibleBookBackgrounds()
  const translation = findInstalledBible(bibles, loadBibleTranslation())
  const afrikaans = isAfrikaansBibleTranslation(translation)
  const [bookId, setBookId] = useState(bibleBooks[0]?.id ?? 'gen')
  const [library, setLibrary] = useState<OrderFolderImage[]>([])

  useEffect(() => {
    if (typeof window.orion?.listBackgroundImages !== 'function') return
    void window.orion.listBackgroundImages().then(setLibrary).catch(() => setLibrary([]))
  }, [])

  const assigned = assignments[bookId] ?? ''
  const selectedImage =
    library.find((image) => backgroundImagesMatch(assigned, image.path))?.path ?? ''

  return (
    <>
      <div className="settings-bg__section-head">
        <h3 className="settings-bg__subtitle">Book backgrounds</h3>
        <p className="adw-caption">
          Use the Bible background, or pick a different image for one book. Names follow the selected translation.
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
                ? `${getBookDisplayName(book.id, afrikaans)} · custom`
                : getBookDisplayName(book.id, afrikaans)
            }))}
            onChange={setBookId}
          />
        </div>
        <div className="settings-bg__field">
          <span className="settings-field__label">Background</span>
          <AdwSelect
            value={selectedImage}
            aria-label="Background for this book"
            options={[
              { value: '', label: 'Use Bible background' },
              ...library.map((image) => ({ value: image.path, label: image.name }))
            ]}
            onChange={(path) => setBibleBookBackground(bookId, path || null)}
          />
        </div>
      </div>
    </>
  )
}
