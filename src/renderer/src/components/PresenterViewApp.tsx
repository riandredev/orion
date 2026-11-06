import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { PresenterViewState } from '../../../shared/presenter-view-state'
import { blurShortcutTarget } from '../lib/focus'
import { PresentationStage } from './PresentationStage'
import { SlideThumb } from './SlideThumb'
import { AppIcon } from './AppIcon'

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

export function PresenterViewApp(): ReactElement {
  const [state, setState] = useState<PresenterViewState | null>(null)
  const stripRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    void window.orionPresenter.getState().then(setState)
    return window.orionPresenter.onState(setState)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (state?.showAllSlides) {
          void window.orionPresenter.setShowAllSlides(false)
        } else {
          void window.orionPresenter.close()
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const target = e.target as HTMLElement
        const inField =
          target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA'
        if (inField) return
        e.preventDefault()
        blurShortcutTarget(e.target)
        void window.orionPresenter.stepSlide(e.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state?.showAllSlides])

  useEffect(() => {
    if (state?.showAllSlides) return
    stripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [state?.slideIndex, state?.showAllSlides])

  const loadDeck = useCallback(
    (id: string) => window.orionPresenter.readDeckSource(id),
    []
  )

  if (!state?.open || state.slides.length === 0) {
    return (
      <div className="presenter-window presenter-window--empty">
        <p className="adw-caption">Loading presenter view…</p>
      </div>
    )
  }

  const slide = state.slides[state.slideIndex]
  const slideUrl = slide?.path ? filePathToUrl(slide.path) : null

  return (
    <div className="presenter-window">
      {state.showAllSlides ? (
        <div className="presenter-window__all-slides">
          <header className="presenter-window__all-head">
            <button
              type="button"
              className="adw-button adw-button--flat adw-button--icon-sm"
              aria-label="Back to presenter view"
              onClick={() => void window.orionPresenter.setShowAllSlides(false)}
            >
              <AppIcon name="caretLeft" size={18} />
            </button>
            <span className="adw-title-4">All slides</span>
          </header>
          <ul className="presenter-window__all-grid" aria-label="All slides">
            {state.slides.map((s) => {
              const selected = s.index === state.slideIndex
              return (
                <li key={s.index}>
                  <button
                    type="button"
                    className={
                      selected
                        ? 'presenter-window__all-thumb presenter-window__all-thumb--active'
                        : 'presenter-window__all-thumb'
                    }
                    onClick={() => {
                      void window.orionPresenter.setSlideIndex(s.index)
                    }}
                  >
                    <span className="presenter-window__all-num">{s.index + 1}</span>
                    {state.engine === 'live' && state.deckId ? (
                      <SlideThumb deckId={state.deckId} ext={state.sourceExt} slideIndex={s.index} />
                    ) : (
                      <img src={filePathToUrl(s.path)} alt="" loading="lazy" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <>
          <div className="presentation-presenter presentation-presenter--window">
            <header className="presenter-window__bar" role="toolbar" aria-label="Presenter controls">
              <div className="presenter-window__bar-group">
                <button
                  type="button"
                  className="adw-button adw-button--flat adw-button--icon-sm"
                  aria-label="Previous slide"
                  onClick={() => void window.orionPresenter.stepSlide(-1)}
                >
                  <AppIcon name="caretLeft" size={16} />
                </button>
                <span className="presenter-window__count">
                  {state.slideIndex + 1} / {state.slideCount}
                </span>
                <button
                  type="button"
                  className="adw-button adw-button--flat adw-button--icon-sm"
                  aria-label="Next slide"
                  onClick={() => void window.orionPresenter.stepSlide(1)}
                >
                  <AppIcon name="caretRight" size={16} />
                </button>
              </div>
              <span className="presenter-window__title">{state.deckTitle}</span>
              <div className="presenter-window__bar-group">
                <button
                  type="button"
                  className="adw-button adw-button--flat adw-button--small"
                  onClick={() => void window.orionPresenter.setShowAllSlides(true)}
                >
                  <AppIcon name="images" size={16} />
                  All slides
                </button>
                <button
                  type="button"
                  className="adw-button adw-button--flat adw-button--small"
                  onClick={() => void window.orionPresenter.close()}
                >
                  Close
                </button>
              </div>
            </header>
            <div
              className={
                state.engine === 'live'
                  ? 'presentation-presenter__main presentation-presenter__main--solo'
                  : 'presentation-presenter__main'
              }
            >
              <div className="presentation-presenter__current">
                {state.engine === 'live' && state.deckId ? (
                  <PresentationStage
                    deckId={state.deckId}
                    ext={state.sourceExt}
                    slideIndex={state.slideIndex}
                    loadSource={loadDeck}
                    showNotes
                    animateTransitions
                  />
                ) : slideUrl ? (
                  <img src={slideUrl} alt={slide?.name ?? 'Current slide'} />
                ) : null}
              </div>
              {state.engine === 'live' ? null : (
              <div className="presentation-presenter__notes">
                <span className="presentation-presenter__notes-label adw-caption">Notes</span>
                <p className="presentation-presenter__notes-body adw-caption">
                  Speaker notes from PowerPoint are not imported yet.
                </p>
              </div>
              )}
            </div>
            <div className="presentation-presenter__strip" role="tablist" aria-label="Slides">
              {state.slides.map((s) => {
                const selected = s.index === state.slideIndex
                return (
                  <button
                    key={s.index}
                    type="button"
                    role="tab"
                    ref={selected ? stripRef : undefined}
                    aria-selected={selected}
                    className={
                      selected
                        ? 'presentation-presenter__strip-thumb presentation-presenter__strip-thumb--active'
                        : 'presentation-presenter__strip-thumb'
                    }
                    onClick={() => void window.orionPresenter.setSlideIndex(s.index)}
                    title={s.name}
                  >
                    <span className="presentation-presenter__strip-num">{s.index + 1}</span>
                    {state.engine === 'live' && state.deckId ? (
                      <SlideThumb deckId={state.deckId} ext={state.sourceExt} slideIndex={s.index} />
                    ) : (
                      <img src={filePathToUrl(s.path)} alt="" loading="lazy" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
