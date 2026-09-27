import { useEffect, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { Ask } from '../lib/types'
import { baseType, fileExtension } from '../lib/video'
import ClipRecorder, { type RecordedClip } from './ClipRecorder'

type Props = {
  personId: string
  personName: string
  // the code from the url, so a refresh can find the question again
  token: string
}

type Stage = 'idle' | 'recording' | 'waiting' | 'done'

// layer 3 (ASK): film 5 seconds, send it, the family's answer shows up here
// without tapping anything.
// layer 4 (HONEST NO): if the family doesnt know either, we say so
function AskFamily({ personId, personName, token }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [askId, setAskId] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [sentAt, setSentAt] = useState(0)
  const [now, setNow] = useState(Date.now())

  const storageKey = 'lexicon-ask-' + token

  // if the page got refreshed while waiting, pick the question back up
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) {
        setAskId(saved)
        setStage('waiting')
      }
    } catch {
      // private browsing can block this. thats fine
    }
  }, [storageKey])

  // while waiting: listen live, AND check every 10 seconds just in case.
  // a missed live message would mean a nurse gives up waiting
  useEffect(() => {
    if (!supabase || !askId || stage !== 'waiting') return
    const client = supabase

    function handle(row: Ask) {
      setAsk(row)
      // after a refresh we dont know when it was sent, so use the row's time
      setSentAt((old) => old || new Date(row.created_at).getTime())
      if (row.status !== 'open') {
        setStage('done')
        try {
          sessionStorage.removeItem(storageKey)
        } catch {
          // ignore
        }
      }
    }

    async function check() {
      const { data } = await client.from('ask_requests').select('*').eq('id', askId).maybeSingle()
      if (data) handle(data as Ask)
    }
    check()

    const channel = client
      .channel('ask-' + askId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ask_requests', filter: 'id=eq.' + askId },
        (payload) => handle(payload.new as Ask),
      )
      .subscribe()

    const poll = window.setInterval(check, 10000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)

    return () => {
      client.removeChannel(channel)
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [askId, stage, storageKey])

  async function send(clip: RecordedClip) {
    if (!supabase || sending) return
    setSending(true)
    setError('')

    // strangers can ONLY upload into this folder (see 0004 storage rules)
    const path = personId + '/asks/' + crypto.randomUUID() + '.' + fileExtension(clip.mimeType)

    try {
      const { error: uploadError } = await supabase.storage
        .from('signals')
        .upload(path, clip.blob, { contentType: baseType(clip.mimeType) })
      if (uploadError) throw uploadError

      const { data, error: askError } = await supabase.rpc('create_ask', {
        p_person: personId,
        p_video_path: path,
        p_mime: clip.mimeType,
        p_note: note,
      })
      if (askError) throw askError

      setAskId(data as string)
      setSentAt(Date.now())
      setStage('waiting')
      try {
        sessionStorage.setItem(storageKey, data as string)
      } catch {
        // ignore
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  function startOver() {
    setStage('idle')
    setAsk(null)
    setAskId('')
    setNote('')
    setError('')
  }

  const waitedSeconds = sentAt ? Math.max(0, Math.floor((now - sentAt) / 1000)) : 0

  return (
    <section className="rounded-lg border-2 border-accent bg-card p-5">
      {stage === 'idle' && (
        <>
          <h2 className="text-xl font-bold">None of these match?</h2>
          <p className="mt-1">
            Film 5 seconds of what {personName} is doing. It goes straight to their family, and their
            answer shows up right here.
          </p>
          <button type="button" onClick={() => setStage('recording')} className="btn mt-4 w-full">
            Ask the family
          </button>
        </>
      )}

      {stage === 'recording' && (
        <>
          <h2 className="text-xl font-bold">Film what you're seeing</h2>
          <div className="mt-3">
            <ClipRecorder maxSeconds={5} doneLabel={sending ? 'Sending…' : 'Send to family'} onDone={send} busy={sending} />
          </div>
          <label htmlFor="ask-note" className="label mt-4">
            Anything to add? <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="ask-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. started after we moved him to the bed"
            className="input"
          />
          {error && (
            <p role="alert" className="mt-3 text-bad">
              {error}
            </p>
          )}
          <button type="button" onClick={startOver} disabled={sending} className="mt-3 text-muted underline">
            Cancel
          </button>
        </>
      )}

      {stage === 'waiting' && (
        <div aria-live="polite">
          <h2 className="text-xl font-bold">Sent to {personName}'s family</h2>
          <p className="mt-1">Keep this page open. Their answer will show up here by itself.</p>
          <p className="mt-3 text-muted">
            Waiting {Math.floor(waitedSeconds / 60)}:{String(waitedSeconds % 60).padStart(2, '0')}
          </p>
          {waitedSeconds > 180 && (
            <p className="mt-2 text-muted">
              No answer yet. They might be driving or asleep. Keep this open, or use your normal
              judgement in the meantime.
            </p>
          )}
        </div>
      )}

      {stage === 'done' && ask && ask.status === 'answered' && (
        <div aria-live="assertive">
          <p className="text-sm font-semibold text-good">✓ The family answered</p>
          <p className="mt-2 font-serif text-2xl font-bold">{ask.answer}</p>
          <button type="button" onClick={startOver} className="btn-secondary mt-4">
            Ask something else
          </button>
        </div>
      )}

      {stage === 'done' && ask && ask.status === 'unknown' && (
        <div aria-live="assertive">
          <h2 className="text-xl font-bold">The family doesn't recognise this one</h2>
          {ask.answer && <p className="mt-2">They said: “{ask.answer}”</p>}
          <p className="mt-2">
            That's a real answer, not a guess. It isn't one of {personName}'s known signals, so use your
            normal judgement.
          </p>
          <button type="button" onClick={startOver} className="btn-secondary mt-4">
            Ask something else
          </button>
        </div>
      )}
    </section>
  )
}

export default AskFamily
