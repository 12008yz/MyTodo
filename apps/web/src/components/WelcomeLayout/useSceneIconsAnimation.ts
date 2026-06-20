import { useEffect, useRef, type RefObject } from 'react'
import {
  FLOAT_ITEM_COUNT,
  ICON_ITEM_DURATION_MS,
  ICON_ITEM_STAGGER_MS,
  ICON_TRANSITION_EASING,
  ICON_TRAVEL_PX,
  getIconItemDurationMs,
  type IconAnimationPhase,
  type IconTransition,
} from '../../constants/transitions'

type UseSceneIconsAnimationOptions = {
  iconTransition: IconTransition
  sceneItemsRef: RefObject<(HTMLDivElement | null)[]>
  onAnimationComplete?: (phase: IconAnimationPhase) => void
}

type ItemAnimation = {
  cancel: () => void
}

function getItems(ref: RefObject<(HTMLDivElement | null)[]>): HTMLDivElement[] {
  return (ref.current ?? []).filter((item): item is HTMLDivElement => item != null)
}

function getDelayMs(index: number, phase: IconAnimationPhase): number {
  if (phase === 'enter') {
    return 0
  }

  return index * ICON_ITEM_STAGGER_MS
}

function getItemDurationMs(index: number, phase: IconAnimationPhase): number {
  if (phase === 'enter') {
    return ICON_ITEM_DURATION_MS
  }

  return getIconItemDurationMs(index)
}

function getMaxTransitionMs(phase: IconAnimationPhase): number {
  let maxFinish = 0
  for (let index = 0; index < FLOAT_ITEM_COUNT; index++) {
    maxFinish = Math.max(
      maxFinish,
      getDelayMs(index, phase) + getItemDurationMs(index, phase),
    )
  }
  return maxFinish
}

function setTransform(element: HTMLElement, y: number) {
  const value = `translate3d(0, ${y}px, 0.01px)`
  element.style.transform = value
  element.style.webkitTransform = value
}

function clearMotionStyles(element: HTMLElement) {
  element.style.transition = ''
  element.style.webkitTransition = ''
  element.style.transform = ''
  element.style.webkitTransform = ''
  element.style.willChange = ''
  element.removeAttribute('data-motion-active')
}

function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function animateItemY(
  element: HTMLDivElement,
  index: number,
  phase: IconAnimationPhase,
  runId: number,
  getRunId: () => number,
): ItemAnimation {
  const travel = ICON_TRAVEL_PX
  const fromY = phase === 'exit' ? 0 : travel
  const toY = phase === 'exit' ? -travel : 0
  const delayMs = getDelayMs(index, phase)

  let delayTimer = 0
  let cancelled = false

  const cancel = () => {
    cancelled = true
    window.clearTimeout(delayTimer)
  }

  element.setAttribute('data-motion-active', 'true')
  element.style.willChange = 'transform'
  element.style.transition = 'none'
  element.style.webkitTransition = 'none'
  setTransform(element, fromY)
  void element.offsetHeight

  delayTimer = window.setTimeout(() => {
    if (cancelled || runId !== getRunId()) return

    const durationMs = getItemDurationMs(index, phase)
    const transition = `transform ${durationMs}ms ${ICON_TRANSITION_EASING}`
    element.style.transition = transition
    element.style.webkitTransition = transition
    setTransform(element, toY)
  }, delayMs)

  return { cancel }
}

export function useSceneIconsAnimation({
  iconTransition,
  sceneItemsRef,
  onAnimationComplete,
}: UseSceneIconsAnimationOptions) {
  const onCompleteRef = useRef(onAnimationComplete)
  const runIdRef = useRef(0)

  useEffect(() => {
    onCompleteRef.current = onAnimationComplete
  }, [onAnimationComplete])

  useEffect(() => {
    if (iconTransition === 'idle') {
      for (const item of getItems(sceneItemsRef)) {
        clearMotionStyles(item)
      }
      return
    }

    const phase: IconAnimationPhase | null =
      iconTransition === 'exit-up'
        ? 'exit'
        : iconTransition === 'enter-from-bottom'
          ? 'enter'
          : null

    if (!phase) return

    const runId = ++runIdRef.current
    let finishTimer = 0
    let retryFrame = 0
    let itemAnimations: ItemAnimation[] = []
    let started = false
    let cancelled = false

    const finish = () => {
      if (runId !== runIdRef.current) return
      onCompleteRef.current?.(phase)
    }

    const start = async () => {
      if (started || runId !== runIdRef.current) return

      const items = getItems(sceneItemsRef)
      if (items.length < FLOAT_ITEM_COUNT) return

      started = true
      await waitTwoFrames()

      if (cancelled || runId !== runIdRef.current) return

      itemAnimations = items.map((item, index) =>
        animateItemY(item, index, phase, runId, () => runIdRef.current),
      )
      finishTimer = window.setTimeout(finish, getMaxTransitionMs(phase) + 100)
    }

    const tryStart = (attempt = 0) => {
      if (runId !== runIdRef.current) return

      void start()

      if (!started && attempt < 20) {
        retryFrame = window.requestAnimationFrame(() => tryStart(attempt + 1))
      } else if (!started) {
        finish()
      }
    }

    tryStart()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(retryFrame)
      window.clearTimeout(finishTimer)
      for (const animation of itemAnimations) {
        animation.cancel()
      }
    }
  }, [iconTransition, sceneItemsRef])

  return null
}
