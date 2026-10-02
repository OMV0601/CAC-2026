import { useLayoutEffect, useRef } from 'react'
import { ease, useDemoTime } from './clock'
import type { Script } from './script'

// the round "finger" that moves to each button and taps it.
// it looks up where the buttons are on screen (they have data-demo="...")

const TRAVEL = 0.55 // seconds to slide to the next button

function center(stage: HTMLElement, target: string) {
  const el = stage.querySelector<HTMLElement>(`[data-demo="${target}"]`)
  if (!el) return null
  const box = el.getBoundingClientRect()
  const stageBox = stage.getBoundingClientRect()
  // the stage may be scaled down to fit the window, so undo that
  const scale = stageBox.width / 1920
  return {
    x: (box.left + box.width / 2 - stageBox.left) / scale,
    y: (box.top + box.height / 2 - stageBox.top) / scale,
  }
}

function Cursor({ script, stageRef }: { script: Script; stageRef: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useDemoTime()
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  // last known spot of every button (they disappear after being tapped)
  const known = useRef(new Map<string, { x: number; y: number }>())

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || !dot.current || !ring.current) return

    for (const tap of script.taps) {
      const spot = center(stage, tap.target)
      if (spot) known.current.set(tap.target, spot)
    }

    // the last tap that already happened, and the next one coming up
    let prev = null
    let next = null
    for (const tap of script.taps) {
      if (tap.at <= t) prev = tap
      else {
        next = tap
        break
      }
    }

    const nextSpot = next ? (known.current.get(next.target) ?? center(stage, next.target)) : null
    const prevSpot = prev ? known.current.get(prev.target) : null

    let x = 0
    let y = 0
    let show = 0
    if (next && nextSpot && t >= next.at - TRAVEL) {
      // moving toward the next button
      const from = prevSpot && prev && next.at - prev.at < 6 ? prevSpot : { x: nextSpot.x + 60, y: nextSpot.y + 140 }
      const k = ease(t, next.at - TRAVEL, TRAVEL)
      x = from.x + (nextSpot.x - from.x) * k
      y = from.y + (nextSpot.y - from.y) * k
      show = prevSpot && prev && next.at - prev.at < 6 ? 1 : ease(t, next.at - TRAVEL, 0.25)
    } else if (prev && prevSpot) {
      // resting on the last button, then fading away if nothing happens
      x = prevSpot.x
      y = prevSpot.y
      show = 1 - ease(t, prev.at + 1.2, 0.5)
    }

    // pressed = smaller dot for a moment
    const sincePrev = prev ? t - prev.at : 99
    const pressed = sincePrev < 0.18 ? 0.8 : 1
    dot.current.style.transform = `translate(${x - 22}px, ${y - 22}px) scale(${pressed})`
    dot.current.style.opacity = String(show * 0.9)

    // ripple ring right after a tap
    const ripple = sincePrev < 0.5 ? sincePrev / 0.5 : 1
    ring.current.style.transform = `translate(${(prevSpot?.x ?? 0) - 30}px, ${(prevSpot?.y ?? 0) - 30}px) scale(${0.6 + ripple * 1.2})`
    ring.current.style.opacity = String(sincePrev < 0.5 ? (1 - ripple) * 0.8 : 0)
  })

  return (
    <>
      <div
        ref={ring}
        className="pointer-events-none absolute top-0 left-0 z-50 h-[60px] w-[60px] rounded-full border-4 border-accent"
        style={{ opacity: 0 }}
      />
      <div
        ref={dot}
        className="pointer-events-none absolute top-0 left-0 z-50 h-[44px] w-[44px] rounded-full border-[3px] border-white bg-accent/45"
        style={{ opacity: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}
      />
    </>
  )
}

export default Cursor
