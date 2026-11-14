import type { ReactElement } from 'react'
import { projectionContentInsetsPreviewVars } from '../../../shared/projection-content-insets'
import type { ProjectionContentInsetCategory } from '../../../shared/projection-content-insets'
import { resolveCategoryBackground, useBackgroundSettings, type BackgroundCategoryId } from '../lib/background-settings'
import { useProjectionContentInsetsByCategory } from '../lib/projection-content-insets-settings'
import { BackgroundStagePreview } from './BackgroundStagePreview'
import { displayFileUrl } from '../lib/file-url'

function fileUrl(filePath: string): string {
  return displayFileUrl(filePath)
}

export function CategoryProjectionPreview({
  category
}: {
  category: ProjectionContentInsetCategory
}): ReactElement {
  const insets = useProjectionContentInsetsByCategory()[category]
  const backgrounds = useBackgroundSettings()
  const previewCategory = category as BackgroundCategoryId
  const resolved = resolveCategoryBackground(previewCategory, backgrounds)

  return (
    <div
      className="settings-general__preview-wrap orion-projection-content-insets"
      style={projectionContentInsetsPreviewVars(insets)}
    >
      <BackgroundStagePreview
        category={previewCategory}
        backgroundColor={resolved.solidColor}
        backgroundImageUrl={resolved.imagePath ? fileUrl(resolved.imagePath) : undefined}
        dimOpacity={resolved.dimOpacity}
        dimColor={resolved.dimColor}
        fit={resolved.fit}
        contentInsets={insets}
      />
    </div>
  )
}
