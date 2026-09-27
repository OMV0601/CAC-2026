import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { getCamera, pickMimeType, stopCamera } from '../lib/video'

export type RecordedClip = {
  blob: Blob
  // what the browser REALLY recorded, e.g. "video/webm;codecs=vp9,opus"
  mimeType: string
  durationMs: number
}

type Props = {
  maxSeconds: number
  // text on the button after recording, like "Send to family"
  doneLabel: string
  onDone: (clip: RecordedClip) => void
  // true while the parent is uploading or whatever, so they cant double tap
  busy?: boolean
}

// what the recorder is doing right now
type Stage = 'starting' | 'live' | 'recording' | 'review' | 'error'

// the camera box + record/stop buttons. used for recording signals,
// for asking the family, and for side by side comparing
function ClipRecorder({ maxSeconds, doneLabel, onDone, busy }: Props) {
  const [stage, setStage] = useState<Stage>('starting')
  const [cameraError, setCameraError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [clip, setClip] = useState<RecordedClip | null>(null)

  // refs = things we need to hold onto that dont need a re-render
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const clipUrlRef = useRef('')
  const mountedRef = useRef(true)

  async function startCamera() {
    setStage('starting')
    setCameraError('')
    try {
      const stream = await getCamera()
      // if we left the page while waiting, turn it straight back off
      if (!mountedRef.current) {
        stopCamera(stream)
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.removeAttribute('src')
        video.srcObject = stream
        video.muted = true // or you hear yourself echo
        video.play().catch(() => {})
      }
      setStage('live')
    } catch (err) {
      if (!mountedRef.current) return
      setCameraError(getErrorMessage(err))
      setStage('error')
    }
  }

  // camera on when this shows up, off when it goes away
  useEffect(() => {
    mountedRef.current = true
    startCamera()
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      stopCamera(streamRef.current)
      streamRef.current = null
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current)
    }
  }, [])

  function startRecording() {
    const stream = streamRef.current
    if (!stream) return
    if (typeof MediaRecorder === 'undefined') {
      setCameraError("This browser can't record video. Try Chrome or Safari.")
      setStage('error')
      return
    }

    const mimeType = pickMimeType()
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => finishRecording(recorder)

    recorder.start()
    recorderRef.current = recorder
    startTimeRef.current = Date.now()
    setSeconds(0)
    setStage('recording')

    // count up, and stop by itself at the max
    timerRef.current = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setSeconds(secs)
      if (secs >= maxSeconds) stopRecording()
    }, 250)
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  function finishRecording(recorder: MediaRecorder) {
    const durationMs = Date.now() - startTimeRef.current
    const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'video/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })

    // camera off, we're done with it
    stopCamera(streamRef.current)
    streamRef.current = null

    // play the clip back.
    // srcObject always wins over src, so we HAVE to clear it first
    // or the recorded clip never shows up
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current)
    const url = URL.createObjectURL(blob)
    clipUrlRef.current = url
    const video = videoRef.current
    if (video) {
      video.srcObject = null
      video.src = url
      video.muted = false
      video.play().catch(() => {})
    }

    setClip({ blob, mimeType, durationMs })
    setStage('review')
  }

  function recordAgain() {
    setClip(null)
    startCamera()
  }

  return (
    <div>
      {/* the one video box. shows the live camera, then the recorded clip */}
      <div className="relative overflow-hidden rounded-lg bg-ink">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          loop={stage === 'review'}
          controls={stage === 'review'}
          className={'aspect-[4/3] w-full object-cover ' + (stage === 'error' ? 'hidden' : '')}
        />
        {stage === 'starting' && (
          <p className="absolute inset-0 flex items-center justify-center text-accent-ink">
            Turning on the camera…
          </p>
        )}
        {stage === 'recording' && (
          <p className="absolute left-3 top-3 rounded bg-bad px-2 py-1 text-sm font-bold text-accent-ink">
            ● REC {seconds}s / {maxSeconds}s
          </p>
        )}
      </div>

      {/* screen readers hear what's happening */}
      <p className="sr-only" aria-live="polite">
        {stage === 'recording' ? 'Recording' : stage === 'review' ? 'Recording finished' : ''}
      </p>

      {stage === 'error' && (
        <div className="mt-4 rounded-lg border border-bad bg-card p-4">
          <p role="alert" className="text-bad">
            {cameraError}
          </p>
          <button type="button" onClick={startCamera} className="btn mt-3">
            Try again
          </button>
        </div>
      )}

      {stage === 'live' && (
        <button type="button" onClick={startRecording} className="btn mt-4 w-full">
          Start recording
        </button>
      )}

      {stage === 'recording' && (
        <button type="button" onClick={stopRecording} className="btn-danger mt-4 w-full">
          Stop
        </button>
      )}

      {stage === 'review' && clip && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => onDone(clip)} disabled={busy} className="btn flex-1">
            {doneLabel}
          </button>
          <button type="button" onClick={recordAgain} disabled={busy} className="btn-secondary">
            Record again
          </button>
        </div>
      )}
    </div>
  )
}

export default ClipRecorder
