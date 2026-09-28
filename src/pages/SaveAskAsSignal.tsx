import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SignalFields, { emptySignalFields, type SignalFieldValues } from '../components/SignalFields'
import { getErrorMessage } from '../lib/errors'
import { saveSignal } from '../lib/saveSignal'
import { supabase } from '../lib/supabase'
import type { Ask } from '../lib/types'
import { makePoster } from '../lib/video'
import { usePageTitle } from '../lib/usePageTitle'

// turns an answered ask into a permanent signal.
// a phone call is forgotten after the shift. this way the next nurse
// doesnt have to ask the same question again
function SaveAskAsSignal() {
  usePageTitle('Save as a signal')
  const { askId } = useParams()
  const navigate = useNavigate()
  const [ask, setAsk] = useState<(Ask & { people: { name: string } | null }) | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [fields, setFields] = useState<SignalFieldValues>(emptySignalFields)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!supabase || !askId) return
      try {
        const { data, error } = await supabase
          .from('ask_requests')
          .select('*, people(name)')
          .eq('id', askId)
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Question not found.')
        if (data.status !== 'answered') throw new Error('Only answered questions can be saved as a signal.')
        if (!data.video_path) throw new Error('This question has no video.')

        // already saved once? dont make a duplicate
        const { data: existing } = await supabase
          .from('signals')
          .select('id')
          .eq('source_ask_id', askId)
          .limit(1)
        if (existing && existing.length > 0) throw new Error('This answer is already saved as a signal.')

        setAsk(data)
        // start the form off with their answer
        setFields({ ...emptySignalFields, meaning: data.answer ?? '' })

        const { data: signed } = await supabase.storage.from('signals').createSignedUrl(data.video_path, 60 * 60)
        if (signed) setVideoUrl(signed.signedUrl)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [askId])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !ask || !ask.video_path || saving) return
    setSaving(true)
    setError('')
    try {
      // grab the stranger's clip and save a copy as a normal signal
      const { data: blob, error: downloadError } = await supabase.storage
        .from('signals')
        .download(ask.video_path)
      if (downloadError) throw downloadError

      const mimeType = ask.mime_type || blob.type || 'video/webm'
      await saveSignal({
        personId: ask.person_id,
        video: blob,
        mimeType,
        durationMs: null,
        poster: await makePoster(blob),
        fields,
        sourceAskId: ask.id,
      })
      navigate('/people/' + ask.person_id)
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <div>
      <Link to="/inbox" className="text-sm text-muted underline">
        ← Inbox
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-bold">Save as a signal</h1>

      {!ask ? (
        <p role="alert" className="mt-4 text-bad">
          {error}
        </p>
      ) : (
        <>
          <p className="mt-1 text-muted">
            Add this to {ask.people?.name ?? 'their'}'s lexicon, so the next person doesn't have to ask.
          </p>
          <form onSubmit={handleSave} className="mt-4 space-y-5">
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                muted
                loop
                autoPlay
                playsInline
                className="aspect-[4/3] w-full rounded-lg bg-ink object-cover"
              />
            )}

            <SignalFields value={fields} onChange={setFields} />

            {error && (
              <p role="alert" className="text-bad">
                {error}
              </p>
            )}

            <button type="submit" disabled={saving} className="btn w-full">
              {saving ? 'Saving…' : 'Save signal'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

export default SaveAskAsSignal
