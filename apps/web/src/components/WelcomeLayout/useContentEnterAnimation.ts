import { useEffect, useState, type RefObject } from 'react'

export function useContentEnterAnimation(
  contentRef: RefObject<HTMLDivElement | null>,
  entering: boolean,
): boolean {
  const [prevEntering, setPrevEntering] = useState(entering)
  const [enterReady, setEnterReady] = useState(true)

  if (entering !== prevEntering) {
    setPrevEntering(entering)
    setEnterReady(!entering)
  }

  const enterPending = entering && !enterReady

  useEffect(() => {
    if (!enterPending) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = window.requestAnimationFrame(() => setEnterReady(true))
      return () => window.cancelAnimationFrame(frame)
    }

    let outerFrame = 0
    let innerFrame = 0
    let cancelled = false

    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        if (cancelled) return
        const element = contentRef.current
        if (element) void element.offsetHeight
        setEnterReady(true)
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(outerFrame)
      window.cancelAnimationFrame(innerFrame)
    }
  }, [enterPending, contentRef])

  return enterPending
}
