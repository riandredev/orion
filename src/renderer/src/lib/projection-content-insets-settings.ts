import { useSyncExternalStore } from 'react'
import {
  clampProjectionContentInsets,
  clampProjectionContentInsetsByCategory,
  DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY,
  type ProjectionContentInsetCategory,
  type ProjectionContentInsetsByCategory,
  type ProjectionContentInsetsVmin
} from '../../../shared/projection-content-insets'
import { touchProfileSettings } from './profile-autosave'

const STORAGE_KEY = 'orion-projection-content-insets-v2'
const LEGACY_STORAGE_KEY = 'orion-projection-content-insets-v1'

let cached: ProjectionContentInsetsByCategory | null = null
const listeners = new Set<() => void>()

function readLegacyV1(): ProjectionContentInsetsByCategory | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const flat = clampProjectionContentInsets(JSON.parse(raw) as Partial<ProjectionContentInsetsVmin>)
    return {
      bible: flat,
      hymns: flat,
      dictionary: DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY.dictionary
    }
  } catch {
    return null
  }
}

export function loadProjectionContentInsetsByCategory(): ProjectionContentInsetsByCategory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return clampProjectionContentInsetsByCategory(
        JSON.parse(raw) as Partial<ProjectionContentInsetsByCategory>
      )
    }
    return readLegacyV1() ?? DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY
  } catch {
    return DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY
  }
}

export function getProjectionContentInsetsByCategory(): ProjectionContentInsetsByCategory {
  if (!cached) cached = loadProjectionContentInsetsByCategory()
  return cached
}

export function getProjectionContentInsetsForCategory(
  category: ProjectionContentInsetCategory
): ProjectionContentInsetsVmin {
  return getProjectionContentInsetsByCategory()[category]
}

function saveProjectionContentInsetsByCategory(
  next: ProjectionContentInsetsByCategory
): ProjectionContentInsetsByCategory {
  const clamped = clampProjectionContentInsetsByCategory(next)
  cached = clamped
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((l) => l())
  return clamped
}

export function updateProjectionContentInsetsForCategory(
  category: ProjectionContentInsetCategory,
  patch: Partial<ProjectionContentInsetsVmin>
): ProjectionContentInsetsByCategory {
  const current = getProjectionContentInsetsByCategory()
  return saveProjectionContentInsetsByCategory({
    ...current,
    [category]: clampProjectionContentInsets({ ...current[category], ...patch })
  })
}

export function reloadProjectionContentInsetsFromStorage(): void {
  cached = loadProjectionContentInsetsByCategory()
  listeners.forEach((l) => l())
}

export function setProjectionContentInsetsForCategory(
  category: ProjectionContentInsetCategory,
  insets: ProjectionContentInsetsVmin
): ProjectionContentInsetsByCategory {
  const current = getProjectionContentInsetsByCategory()
  return saveProjectionContentInsetsByCategory({
    ...current,
    [category]: clampProjectionContentInsets(insets)
  })
}

export function resetProjectionContentInsetsForCategory(
  category: ProjectionContentInsetCategory
): ProjectionContentInsetsByCategory {
  return updateProjectionContentInsetsForCategory(
    category,
    DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY[category]
  )
}

export function useProjectionContentInsetsByCategory(): ProjectionContentInsetsByCategory {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getProjectionContentInsetsByCategory(),
    () => DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY
  )
}

export async function pushProjectionContentInsetsToMain(
  insets: ProjectionContentInsetsByCategory = getProjectionContentInsetsByCategory()
): Promise<void> {
  if (typeof window.orion?.setProjectionContentInsets !== 'function') return
  await window.orion.setProjectionContentInsets(insets)
}
