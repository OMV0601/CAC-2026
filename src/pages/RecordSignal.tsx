import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ClipRecorder, { type RecordedClip } from '../components/ClipRecorder'
import SignalFields, { emptySignalFields, type SignalFieldValues } from '../components/SignalFields'
import { getErrorMessage } from '../lib/errors'
import { saveSignal } from '../lib/saveSignal'
import { makePoster } from '../lib/video'
import { usePageTitle } from '../lib/usePageTitle'

// longest clip you can record
const MAX_SECONDS = 15

function RecordSignal() {
  usePageTitle('Record a signal')
  const { personId } = useParams()
  const navigate = useNavigate()

  // the recorded clip (null = still recording)
  const [clip, setClip] = useState<RecordedClip | null>(null)
  const [clipUrl, setClipUrl] = useState('')
  const [poster, setPoster] = useState<Blob | null>(null)

  const [fields, setFields] = useState<SignalFieldValues>(emptySignalFields)
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
    if (!personId || !clip || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await saveSignal({
        personId,
        video: clip.blob,
        mimeType: clip.mimeType,
        durationMs: clip.durationMs,
        poster,
        fields,
      })
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

          <SignalFields value={fields} onChange={setFields} />

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
