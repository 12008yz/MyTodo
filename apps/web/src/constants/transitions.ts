export const ICON_ITEM_DURATION_MS = 900
export const ICON_SMOOTHER_ITEM_COUNT = 3
export const ICON_SMOOTHER_DURATION_FACTOR = 1.4
export const ICON_ITEM_STAGGER_MS = 125
export const FLOAT_ITEM_COUNT = 12

export function getIconItemDurationMs(index: number): number {
  if (index < ICON_SMOOTHER_ITEM_COUNT) {
    return Math.round(ICON_ITEM_DURATION_MS * ICON_SMOOTHER_DURATION_FACTOR)
  }
  return ICON_ITEM_DURATION_MS
}
export const ICON_TRAVEL_PX = 600
export const ICON_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

export const ICON_TRANSITION_MS =
  (FLOAT_ITEM_COUNT - 1) * ICON_ITEM_STAGGER_MS + ICON_ITEM_DURATION_MS

export const CONTENT_TRANSITION_DURATION_MS = 350

export function getContentTransitionDurationMs(): number {
  const welcome = document.querySelector('.welcome')
  const raw = welcome
    ? getComputedStyle(welcome).getPropertyValue('--content-transition-duration').trim()
    : ''

  if (raw.endsWith('ms')) {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : CONTENT_TRANSITION_DURATION_MS
  }

  if (raw.endsWith('s')) {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed * 1000 : CONTENT_TRANSITION_DURATION_MS
  }

  return CONTENT_TRANSITION_DURATION_MS
}

export type IconTransition = 'idle' | 'exit-up' | 'enter-from-bottom'

export type IconAnimationPhase = 'exit' | 'enter'
