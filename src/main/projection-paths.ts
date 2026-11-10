import { existsSync } from 'fs'
import { basename, isAbsolute, relative, resolve } from 'path'
import { pathToFileURL } from 'url'
import type { OrionProjectionPayload } from '../shared/projection'
import { clampBibleBlockLayout } from '../shared/bible-block-layout'
import { clampPlacedBlocks, DICTIONARY_BLOCK_IDS, HYMN_BLOCK_IDS } from '../shared/placed-blocks'
import { bibleLocationFromReference } from '../shared/bible-projection-display'
import type { HymnSlideKind } from '../shared/hymnal-projection-sequence'
import { isOrderImageAnimation, type OrionStackLayerContent } from '../shared/projection-stack'
import { imagesRoot, mediaRoot, orderImagesRoot, presentationsRoot } from './paths'

function sanitizeDimColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '#000000'
}

export function isPathUnderRoot(filePath: string, root: string): boolean {
  const normalized = resolve(filePath)
  const rootResolved = resolve(root)
  if (normalized === rootResolved) return true
  const rel = relative(rootResolved, normalized)
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

/** Backgrounds are stored as names inside the image library, or as full paths. */
export function resolveBackgroundImagePath(filePath: string): string {
  const trimmed = filePath.trim()
  const name = basename(trimmed)
  const candidates = [
    isAbsolute(trimmed) ? resolve(trimmed) : resolve(imagesRoot(), trimmed),
    name ? resolve(imagesRoot(), name) : '',
    name ? resolve(imagesRoot(), 'backgrounds', name) : ''
  ].filter((candidate) => candidate.length > 0)

  for (const candidate of candidates) {
    if (existsSync(candidate) && isPathUnderRoot(candidate, imagesRoot())) {
      return resolve(candidate)
    }
  }
  return assertAllowedImagePath(trimmed)
}

export function assertAllowedImagePath(filePath: string): string {
  const normalized = resolve(filePath)
  if (!existsSync(normalized)) {
    throw new Error('Image file not found')
  }
  if (
    isPathUnderRoot(normalized, orderImagesRoot()) ||
    isPathUnderRoot(normalized, imagesRoot()) ||
    isPathUnderRoot(normalized, presentationsRoot()) ||
    isPathUnderRoot(normalized, mediaRoot())
  ) {
    return normalized
  }
  throw new Error('Image path not allowed')
}

export function imagePathToMediaUrl(filePath: string): string {
  return pathToFileURL(assertAllowedImagePath(filePath)).href
}

export function sanitizeProjectionPayload(payload: OrionProjectionPayload): OrionProjectionPayload {
  if (payload.type === 'image') {
    return { type: 'image', filePath: assertAllowedImagePath(payload.filePath) }
  }
  if (payload.type === 'web') {
    const parsed = new URL(payload.url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid web URL')
    }
    return payload
  }
  if (payload.type === 'bible') {
    let backgroundImagePath: string | null = null
    if (typeof payload.backgroundImagePath === 'string' && payload.backgroundImagePath.trim().length > 0) {
      try {
        backgroundImagePath = resolveBackgroundImagePath(payload.backgroundImagePath)
      } catch {
        backgroundImagePath = null
      }
    }
    const backgroundColor =
      typeof payload.backgroundColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(payload.backgroundColor)
        ? payload.backgroundColor
        : '#000000'
    const backgroundDimOpacity =
      typeof payload.backgroundDimOpacity === 'number' && Number.isFinite(payload.backgroundDimOpacity)
        ? Math.min(95, Math.max(0, Math.round(payload.backgroundDimOpacity)))
        : 0
    const backgroundFit = payload.backgroundFit === 'contain' ? 'contain' : 'cover'

    return {
      type: 'bible',
      reference: payload.reference.slice(0, 200),
      highlightVerse: payload.highlightVerse,
      verses: payload.verses.slice(0, 200).map((v) => ({
        number: v.number,
        text: v.text.slice(0, 4000)
      })),
      asOverlay: payload.asOverlay === true,
      backgroundImagePath,
      backgroundColor,
      backgroundDimOpacity,
      backgroundDimColor: sanitizeDimColor(payload.backgroundDimColor),
      backgroundFit
    }
  }
  if (payload.type === 'clear-overlay') {
    return { type: 'clear-overlay' }
  }
  return { type: 'clear' }
}

export function sanitizeStackContent(content: OrionStackLayerContent): OrionStackLayerContent {
  if (content.type === 'media') {
    const name = content.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 180) || 'Media'
    return {
      type: 'media',
      filePath: assertAllowedImagePath(content.filePath),
      name,
      kind: content.kind === 'audio' ? 'audio' : 'video',
      autoplay: content.autoplay === true
    }
  }
  if (content.type === 'image') {
    const animation = isOrderImageAnimation(content.animation) ? content.animation : 'cut'
    const durationMs =
      typeof content.durationMs === 'number' && Number.isFinite(content.durationMs)
        ? Math.min(5000, Math.max(0, Math.round(content.durationMs)))
        : 0
    return {
      type: 'image',
      filePath: assertAllowedImagePath(content.filePath),
      animation,
      durationMs
    }
  }
  if (content.type === 'deck-slide') {
    return {
      type: 'deck-slide',
      markup: content.markup.slice(0, 12_000_000),
      ...(typeof content.fontCss === 'string' && content.fontCss.length > 0
        ? { fontCss: content.fontCss.slice(0, 8_000_000) }
        : {}),
      width: content.width,
      height: content.height,
      transition: content.transition.slice(0, 24),
      durationMs: Math.min(5000, Math.max(0, Math.round(content.durationMs))),
      autoplayMedia: content.autoplayMedia !== false,
      media: content.media.slice(0, 16).flatMap((item) => {
        try {
          return [
            {
              filePath: assertAllowedImagePath(item.filePath),
              leftPct: item.leftPct,
              topPct: item.topPct,
              widthPct: item.widthPct,
              heightPct: item.heightPct,
              kind: item.kind === 'audio' ? 'audio' : 'video'
            }
          ]
        } catch {
          return []
        }
      })
    }
  }
  if (content.type === 'dictionary') {
    let backgroundImagePath: string | null = null
    if (typeof content.backgroundImagePath === 'string' && content.backgroundImagePath.trim().length > 0) {
      try {
        backgroundImagePath = resolveBackgroundImagePath(content.backgroundImagePath)
      } catch {
        backgroundImagePath = null
      }
    }
    const backgroundColor =
      typeof content.backgroundColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(content.backgroundColor)
        ? content.backgroundColor
        : '#000000'
    const backgroundDimOpacity =
      typeof content.backgroundDimOpacity === 'number' && Number.isFinite(content.backgroundDimOpacity)
        ? Math.min(95, Math.max(0, Math.round(content.backgroundDimOpacity)))
        : 0
    const backgroundFit = content.backgroundFit === 'contain' ? 'contain' : 'cover'
    const language =
      content.language === 'greek' || content.language === 'aramaic' ? content.language : 'hebrew'
    const infoBar = Array.isArray(content.infoBar)
      ? content.infoBar.slice(0, 5).map((s) => String(s).slice(0, 48))
      : []
    const infoBarActive =
      typeof content.infoBarActive === 'number' && Number.isFinite(content.infoBarActive)
        ? Math.min(Math.max(0, Math.round(content.infoBarActive)), Math.max(0, infoBar.length - 1))
        : 0
    return {
      type: 'dictionary',
      strongs: content.strongs.slice(0, 16),
      lemma: content.lemma.slice(0, 120),
      transliteration: content.transliteration?.slice(0, 80) ?? null,
      gloss: content.gloss?.slice(0, 200) ?? null,
      partOfSpeech: content.partOfSpeech?.slice(0, 32) ?? null,
      definition: content.definition.slice(0, 4000),
      language,
      infoBar,
      infoBarActive,
      backgroundImagePath,
      backgroundColor,
      backgroundDimOpacity,
      backgroundDimColor: sanitizeDimColor(content.backgroundDimColor),
      backgroundFit,
      blockLayout: clampPlacedBlocks(content.blockLayout, DICTIONARY_BLOCK_IDS)
    }
  }
  if (content.type === 'hymn') {
    let backgroundImagePath: string | null = null
    if (typeof content.backgroundImagePath === 'string' && content.backgroundImagePath.trim().length > 0) {
      try {
        backgroundImagePath = resolveBackgroundImagePath(content.backgroundImagePath)
      } catch {
        backgroundImagePath = null
      }
    }
    const backgroundColor =
      typeof content.backgroundColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(content.backgroundColor)
        ? content.backgroundColor
        : '#000000'
    const backgroundDimOpacity =
      typeof content.backgroundDimOpacity === 'number' && Number.isFinite(content.backgroundDimOpacity)
        ? Math.min(95, Math.max(0, Math.round(content.backgroundDimOpacity)))
        : 0
    const backgroundFit = content.backgroundFit === 'contain' ? 'contain' : 'cover'
    const rawSlideKind = String(content.slideKind ?? 'lyrics').slice(0, 12)
    const slideKind: HymnSlideKind =
      rawSlideKind === 'title' || rawSlideKind === 'end' || rawSlideKind === 'lyrics'
        ? rawSlideKind
        : 'lyrics'
    return {
      type: 'hymn',
      number: content.number,
      title: content.title.slice(0, 200),
      slideKind,
      stanzaKind: String(content.stanzaKind ?? 'verse').slice(0, 20),
      verse:
        typeof content.verse === 'number' && Number.isFinite(content.verse) && content.verse > 0
          ? Math.floor(content.verse)
          : undefined,
      versePart:
        typeof content.versePart === 'number' && Number.isFinite(content.versePart) && content.versePart > 0
          ? Math.min(99, Math.floor(content.versePart))
          : undefined,
      versePartCount:
        typeof content.versePartCount === 'number' &&
        Number.isFinite(content.versePartCount) &&
        content.versePartCount > 1
          ? Math.min(99, Math.floor(content.versePartCount))
          : undefined,
      lines: content.lines.slice(0, 32).map((line) => line.slice(0, 500)),
      author: content.author?.trim() ? content.author.trim().slice(0, 120) : undefined,
      backgroundImagePath,
      backgroundColor,
      backgroundDimOpacity,
      backgroundDimColor: sanitizeDimColor(content.backgroundDimColor),
      backgroundFit,
      blockLayout: clampPlacedBlocks(content.blockLayout, HYMN_BLOCK_IDS),
      animation:
        content.animation === 'push'
          ? 'push'
          : content.animation === 'cut' || content.animation === 'none'
            ? 'cut'
            : 'fade',
      durationMs:
        typeof content.durationMs === 'number' && Number.isFinite(content.durationMs)
          ? Math.min(5000, Math.max(0, Math.round(content.durationMs)))
          : 0
    }
  }
  const bible = sanitizeProjectionPayload({
    type: 'bible',
    reference: content.reference,
    verses: content.verses,
    highlightVerse: content.highlightVerse,
    backgroundImagePath: content.backgroundImagePath,
    backgroundColor: content.backgroundColor,
    backgroundDimOpacity: content.backgroundDimOpacity,
    backgroundDimColor: content.backgroundDimColor,
    backgroundFit: content.backgroundFit
  })
  if (bible.type !== 'bible') {
    throw new Error('Invalid bible content')
  }
  return {
    type: 'bible',
    reference: bible.reference,
    locationLabel: (content.locationLabel || bibleLocationFromReference(bible.reference)).slice(
      0,
      120
    ),
    translationLabel: (content.translationLabel || 'Bible').slice(0, 96),
    verses: bible.verses,
    highlightVerse: bible.highlightVerse,
    backgroundImagePath: bible.backgroundImagePath,
    backgroundColor: bible.backgroundColor,
    backgroundDimOpacity: bible.backgroundDimOpacity,
    backgroundDimColor: bible.backgroundDimColor,
    backgroundFit: bible.backgroundFit,
    blockLayout: clampBibleBlockLayout(content.blockLayout),
    animation:
      content.animation === 'push' ? 'push' : content.animation === 'cut' ? 'cut' : 'fade',
    durationMs:
      typeof content.durationMs === 'number' && Number.isFinite(content.durationMs)
        ? Math.min(5000, Math.max(0, Math.round(content.durationMs)))
        : 0
  }
}
