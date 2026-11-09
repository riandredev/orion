/**
 * Coolicons (fill-round) via Iconify — MIT, by Kryston Schwarze.
 * Rounded, filled UI glyphs; swap icon imports here to try Jam or other sets.
 */
import type { IconifyIcon } from '@iconify/types'

const viewColumns: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M3 4h5v16H3zm6.5 0h5v16h-5zM16 4h5v16h-5z"/>'
}
const viewGrid: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>'
}
const viewList: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M3 5h4v4H3zm6 0h12v4H9zM3 10.5h4v4H3zm6 0h12v4H9zM3 16h4v4H3zm6 0h12v4H9z"/>'
}
const music: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M9 17.5a2.5 2.5 0 1 1-1.8-2.4V6.4l9-1.8v8.5a2.5 2.5 0 1 1-1.8-2.4V6.6l-5.4 1.1v9.8z"/>'
}
const folder: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M4 6.5A1.5 1.5 0 0 1 5.5 5H9l1.6 2H18.5A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5z"/>'
}
const keyboard: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>'
}
const save: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M6 3h9.2L19 6.8V20H6zm2 2v4h6V5zm0 8h8v5H8z"/>'
}
import book from '@iconify-icons/coolicons/book-fill-round'
import chevronLeft from '@iconify-icons/coolicons/chevron-left-fill-round'
import chevronRight from '@iconify-icons/coolicons/chevron-right-fill-round'
import chevronUp from '@iconify-icons/coolicons/chevron-up-fill-round'
import chevronDown from '@iconify-icons/coolicons/chevron-down-fill-round'
import close from '@iconify-icons/coolicons/close-fill-round'
import image from '@iconify-icons/coolicons/image-fill-round'
import listPlus from '@iconify-icons/coolicons/list-plus-fill-round'
import play from '@iconify-icons/coolicons/play-fill-round'
import plus from '@iconify-icons/coolicons/plus-fill-round'
import presentation from '@iconify-icons/coolicons/presentation-fill-round'
import search from '@iconify-icons/coolicons/search-fill-round'
import searchOutline from '@iconify-icons/coolicons/search-round'
import settings from '@iconify-icons/coolicons/settings-fill-round'
import square from '@iconify-icons/coolicons/square-fill-round'
import stop from '@iconify-icons/coolicons/stop-fill-round'
import timer from '@iconify-icons/coolicons/timer-fill-round'
import hash from '@iconify-icons/coolicons/hash-fill-round'
import numberOne from '@iconify-icons/coolicons/number-1-fill-round'
import pause from '@iconify-icons/coolicons/pause-fill-round'
import repeat from '@iconify-icons/coolicons/repeat-fill-round'
import expand from '@iconify-icons/coolicons/expand-fill-round'
import skipBack from '@iconify-icons/coolicons/skip-back-fill-round'
import skipForward from '@iconify-icons/coolicons/skip-forward-fill-round'
import trash from '@iconify-icons/coolicons/trash-fill-round'
import gripVertical from '@iconify-icons/coolicons/menu-alt-4-fill-round'
import globe from '@iconify-icons/coolicons/globe-fill-round'
import video from '@iconify-icons/coolicons/video-fill-round'
import pin from '@iconify-icons/coolicons/pin-fill-round'

const caption: IconifyIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M4 4h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m1 2v7h14V6zm0 12h7v2H5zm9 0h5v2h-5z"/>'
}

export const AppIcons = {
  plus,
  listPlus,
  images: image,
  timer,
  square,
  play,
  pause,
  skipBack,
  skipForward,
  repeat,
  expand,
  clear: stop,
  search,
  searchOutline,
  verseOne: numberOne,
  passageRef: hash,
  book,
  presentation,
  settings,
  keyboard,
  caretLeft: chevronLeft,
  caretRight: chevronRight,
  caretUp: chevronUp,
  caretDown: chevronDown,
  close,
  gripVertical,
  viewColumns,
  viewGrid,
  viewList,
  caption,
  globe,
  video,
  trash,
  music,
  folder,
  save,
  pin
} satisfies Record<string, IconifyIcon>

export type AppIconName = keyof typeof AppIcons

export const ribbonIconSize = 22
export const toolbarIconSize = 18
