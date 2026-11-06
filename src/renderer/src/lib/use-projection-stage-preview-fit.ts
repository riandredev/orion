import { useLayoutEffect, type RefObject } from 'react'
import { applyProjectionSlideFits } from '../../../shared/projection-slide-fit'
import type { BackgroundCategoryId } from './background-settings'

function fitModeForCategory(
  category: BackgroundCategoryId
): 'bible' | 'hymns' | 'dictionary' | null {
  if (category === 'bible') return 'bible'
  if (category === 'hymns') return 'hymns'
  if (category === 'dictionary') return 'dictionary'
  return null
}

export function useProjectionStagePreviewFit(
  canvasRef: RefObject<HTMLElement | null>,
  category: BackgroundCategoryId,
  layoutKey: string
): void {
  useLayoutEffect(() => {
    const mode = fitModeForCategory(category)
    const canvas = canvasRef.current
    if (!mode || !canvas) return

    const run = (): void => {
      requestAnimationFrame(() => {
        applyProjectionSlideFits(canvas, mode)
      })
    }

    run()
    const ro = new ResizeObserver(run)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [canvasRef, category, layoutKey])
}
