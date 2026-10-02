import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties } from 'react'

// the current demo time, shared with everything inside the demo
export const DemoTime = createContext({ t: 0, capture: false })

export function useDemoTime() {
  return useContext(DemoTime)
}

// 0 -> 1 over "dur" seconds starting at "from", with a smooth ease
export function ease(t: number, from: number, dur: number) {
  const x = Math.min(1, Math.max(0, (t - from) / dur))
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

// ---- videos ----
// normally videos just play. when we record the demo frame by frame
// ("capture" mode) we pause them and jump each one to the exact right frame,
// then wait for them to finish jumping before taking the screenshot

let pendingSeeks: Promise<void>[] = []

export function waitForVideos() {
  const all = pendingSeeks
  pendingSeeks = []
  return Promise.all(all)
}

function seek(video: HTMLVideoElement, time: number) {
  if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.004) return
  pendingSeeks.push(
    new Promise<void>((resolve) => {
      let finished = false
      const done = () => {
        if (finished) return
        finished = true
        video.removeEventListener('seeked', done)
        resolve()
      }
      video.addEventListener('seeked', done)
      setTimeout(done, 2000)
      const go = () => {
        video.currentTime = time
      }
      if (video.readyState >= 1) go()
      else video.addEventListener('loadedmetadata', go, { once: true })
    }),
  )
}

type VideoProps = {
  src: string
  poster?: string
  // demo time when this clip should be at its start
  startAt?: number
  className?: string
  style?: CSSProperties
  label?: string
}

export function DemoVideo({ src, poster, startAt = 0, className, style, label }: VideoProps) {
  const { t, capture } = useDemoTime()
  const ref = useRef<HTMLVideoElement>(null)

  useLayoutEffect(() => {
    const video = ref.current
    if (!video || !capture) return
    video.pause()
    const length = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 4
    // stay a hair before the very end so it never shows a blank frame
    const local = Math.max(0, t - startAt) % (length - 0.02)
    seek(video, local)
  })

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay={!capture}
      preload="auto"
      aria-label={label}
      className={className}
      style={style}
    />
  )
}
