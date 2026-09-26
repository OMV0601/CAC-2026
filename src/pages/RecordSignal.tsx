import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { bodyRegionNames, flaccNames, type BodyRegion, type FlaccCategory } from '../lib/types'
import { baseType, fileExtension, getCamera, makePoster, pickMimeType, stopCamera } from '../lib/video'

// longest clip you can record
const MAX_SECONDS = 15

// what the page is doing right now
type Stage = 'starting' | 'live' | 'recording' | 'review' | 'error'

function RecordSignal() {
  const { personId } = useParams()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('starting')
  const [cameraError, setCameraError] = useState('')
  const [seconds, setSeconds] = useState(0)

  // the recorded clip
  const [clip, setClip] = useState<Blob | null>(null)
  const [clipType, setClipType] = useState('')
  const [clipUrl, setClipUrl] = useState('')
  const [durationMs, setDurationMs] = useState(0)
  const [poster, setPoster] = useState<Blob | null>(null)

  // the form
  const [title, setTitle] = useState('')
  const [meaning, setMeaning] = useState('')
  const [action, setAction] = useState('')
  const [bodyRegion, setBodyRegion] = useState<BodyRegion>('whole_body')
  const [hasSound, setHasSound] = useState(false)
  const [flacc, setFlacc] = useState<FlaccCategory | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // refs = things we need to hold onto that dont need a re-render
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  // show the live camera in the video box
  function showLive(stream: MediaStream) {
    const video = videoRef.current
    if (!video) return
    video.removeAttribute('src')
    video.srcObject = stream
    video.muted = true // or you hear yourself echo
    video.play().catch(() => {})
  }

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
      showLive(stream)
      setStage('live')
    } catch (err) {
      if (!mountedRef.current) return
      setCameraError(getErrorMessage(err))
      setStage('error')
    }
  }

  // turn the camera on when the page opens, and off when it closes
  useEffect(() => {
    mountedRef.current = true
    startCamera()
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      stopCamera(streamRef.current)
      streamRef.current = null
    }
  }, [])

  // free the memory for the old clip when we make a new one
  useEffect(() => {
    return () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl)
    }
  }, [clipUrl])

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
      if (secs >= MAX_SECONDS) stopRecording()
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

  async function finishRecording(recorder: MediaRecorder) {
    const duration = Date.now() - startTimeRef.current
    // store what the browser REALLY recorded, not what we asked for
    const type = recorder.mimeType || chunksRef.current[0]?.type || 'video/webm'
    const blob = new Blob(chunksRef.current, { type })

    // camera off, we're done with it
    stopCamera(streamRef.current)
    streamRef.current = null

    // play the clip back.
    // srcObject always wins over src, so we HAVE to clear it first
    // or the recorded clip never shows up
    const url = URL.createObjectURL(blob)
    const video = videoRef.current
    if (video) {
      video.srcObject = null
      video.src = url
      video.muted = false
      video.play().catch(() => {})
    }

    setClip(blob)
    setClipType(type)
    setClipUrl(url)
    setDurationMs(duration)
    setStage('review')

    // grab a still frame for the grid
    setPoster(await makePoster(blob))
  }

  function recordAgain() {
    setClip(null)
    setPoster(null)
    setClipUrl('')
    startCamera()
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !personId || !clip) return
    setSaving(true)
    setSaveError('')

    const id = crypto.randomUUID()
    const videoPath = personId + '/' + id + '.' + fileExtension(clipType)
    let posterPath: string | null = null
    const bucket = supabase.storage.from('signals')

    try {
      // 1. upload the video
      const { error: videoError } = await bucket.upload(videoPath, clip, {
        contentType: baseType(clipType),
      })
      if (videoError) throw videoError

      // 2. upload the poster (if it fails thats ok, the grid just has no poster)
      if (poster) {
        const path = personId + '/' + id + '.jpg'
        const { error: posterError } = await bucket.upload(path, poster, { contentType: 'image/jpeg' })
        if (!posterError) posterPath = path
      }

      // 3. save the row
      const { error: insertError } = await supabase.from('signals').insert({
        id,
        person_id: personId,
        title: title.trim(),
        meaning: meaning.trim(),
        action: action.trim() || null,
        body_region: bodyRegion,
        has_sound: hasSound,
        flacc_category: flacc || null,
        video_path: videoPath,
        poster_path: posterPath,
        mime_type: clipType,
        duration_ms: durationMs,
      })
      if (insertError) {
        // dont leave files lying around with no row pointing at them
        await bucket.remove(posterPath ? [videoPath, posterPath] : [videoPath])
        throw insertError
      }

      navigate('/people/' + personId)
    } catch (err) {
      setSaveError(getErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to={'/people/' + personId} className="text-sm text-muted underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-bold">Record a signal</h1>
      <p className="mt-1 text-muted">
        Film one thing they do, up to {MAX_SECONDS} seconds. Then say what it means.
      </p>

      {/* the one video box. shows the live camera, then the recorded clip */}
      <div className="relative mt-4 overflow-hidden rounded-lg bg-ink">
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
            ● REC {seconds}s / {MAX_SECONDS}s
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

      {stage === 'review' && (
        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <button type="button" onClick={recordAgain} className="btn-secondary">
            Record again
          </button>

          <div>
            <label htmlFor="title" className="label">
              What does it look like?
            </label>
            <input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rocks forward and hums low"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="meaning" className="label">
              What does it mean?
            </label>
            <input
              id="meaning"
              required
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="e.g. Tummy pain"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="action" className="label">
              What should someone do? <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. Check when they last ate, offer the heat pack"
              className="input"
            />
          </div>

          {/* this is what the "point" filter uses later */}
          <fieldset>
            <legend className="label">Where on the body?</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(Object.keys(bodyRegionNames) as BodyRegion[]).map((region) => (
                <label
                  key={region}
                  className={
                    'cursor-pointer rounded-md border px-3 py-2 ' +
                    (bodyRegion === region ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-card')
                  }
                >
                  <input
                    type="radio"
                    name="region"
                    value={region}
                    checked={bodyRegion === region}
                    onChange={() => setBodyRegion(region)}
                    className="sr-only"
                  />
                  {bodyRegionNames[region]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* separate from body region because you can hum while rocking */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasSound}
              onChange={(e) => setHasSound(e.target.checked)}
              className="h-5 w-5"
            />
            It makes a sound
          </label>

          <div>
            <label htmlFor="flacc" className="label">
              Is it a pain sign? <span className="font-normal text-muted">(optional)</span>
            </label>
            <select
              id="flacc"
              value={flacc}
              onChange={(e) => setFlacc(e.target.value as FlaccCategory | '')}
              className="input"
            >
              <option value="">No / not sure</option>
              {(Object.keys(flaccNames) as FlaccCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  Yes: {flaccNames[cat]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-muted">
              These are the categories from the FLACC pain scale nurses already use.
            </p>
          </div>

          {saveError && (
            <p role="alert" className="text-bad">
              {saveError}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn w-full">
            {saving ? 'Saving…' : 'Save signal'}
          </button>
        </form>
      )}
    </div>
  )
}

export default RecordSignal
