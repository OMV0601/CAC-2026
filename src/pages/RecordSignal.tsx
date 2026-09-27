import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ClipRecorder, { type RecordedClip } from '../components/ClipRecorder'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { bodyRegionNames, flaccNames, type BodyRegion, type FlaccCategory } from '../lib/types'
import { baseType, fileExtension, makePoster } from '../lib/video'

// longest clip you can record
const MAX_SECONDS = 15

function RecordSignal() {
  const { personId } = useParams()
  const navigate = useNavigate()

  // the recorded clip (null = still recording)
  const [clip, setClip] = useState<RecordedClip | null>(null)
  const [clipUrl, setClipUrl] = useState('')
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

  // free the memory for the old preview when it changes
  useEffect(() => {
    return () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl)
    }
  }, [clipUrl])

  async function handleClip(recorded: RecordedClip) {
    setClip(recorded)
    setClipUrl(URL.createObjectURL(recorded.blob))
    // grab a still frame for the grid
    setPoster(await makePoster(recorded.blob))
  }

  function recordAgain() {
    setClip(null)
    setClipUrl('')
    setPoster(null)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !personId || !clip || saving) return
    setSaving(true)
    setSaveError('')

    const id = crypto.randomUUID()
    const videoPath = personId + '/' + id + '.' + fileExtension(clip.mimeType)
    let posterPath: string | null = null
    const bucket = supabase.storage.from('signals')

    try {
      // 1. upload the video
      const { error: videoError } = await bucket.upload(videoPath, clip.blob, {
        contentType: baseType(clip.mimeType),
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
        mime_type: clip.mimeType,
        duration_ms: clip.durationMs,
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

      {!clip && (
        <div className="mt-4">
          <ClipRecorder maxSeconds={MAX_SECONDS} doneLabel="Use this clip" onDone={handleClip} />
        </div>
      )}

      {clip && (
        <form onSubmit={handleSave} className="mt-4 space-y-5">
          <video
            src={clipUrl}
            controls
            loop
            playsInline
            className="aspect-[4/3] w-full rounded-lg bg-ink object-cover"
          />
          <button type="button" onClick={recordAgain} disabled={saving} className="btn-secondary">
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
