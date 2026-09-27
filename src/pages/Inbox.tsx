import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { niceTime, type Ask } from '../lib/types'

// an ask plus the person's name and which code it came from
type AskRow = Ask & {
  people: { name: string } | null
  access_grants: { label: string | null } | null
}

// the family's inbox. when a nurse asks "what is this?", it shows up here
// live. answer it and it pops up on their screen
function Inbox() {
  const [asks, setAsks] = useState<AskRow[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    try {
      // RLS only gives back asks for people in our circle
      const { data, error } = await supabase
        .from('ask_requests')
        .select('*, people(name), access_grants(label)')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      const rows = (data ?? []) as AskRow[]
      setAsks(rows)

      const paths = rows.map((a) => a.video_path).filter((p): p is string => !!p)
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from('signals').createSignedUrls(paths, 60 * 60)
        const map: Record<string, string> = {}
        for (const item of signed ?? []) {
          if (item.path && item.signedUrl) map[item.path] = item.signedUrl
        }
        setUrls(map)
      }
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // load now, reload when anything changes (live), and every 30s just in case
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    load()
    const channel = client
      .channel('inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ask_requests' }, () => load())
      .subscribe()
    const poll = window.setInterval(load, 30000)
    return () => {
      client.removeChannel(channel)
      clearInterval(poll)
    }
  }, [load])

  if (loading) return <p className="text-muted">Loading…</p>

  const open = asks.filter((a) => a.status === 'open')
  const done = asks.filter((a) => a.status !== 'open')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold">Inbox</h1>
        <p className="mt-1 text-muted">
          Questions from nurses and aides. Keep this open and new ones show up by themselves.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-bold">Waiting for an answer ({open.length})</h2>
        {open.length === 0 && <p className="mt-2 text-muted">Nothing right now.</p>}
        <ul className="mt-3 space-y-4">
          {open.map((ask) => (
            <OpenAsk
              key={ask.id}
              ask={ask}
              videoUrl={ask.video_path ? (urls[ask.video_path] ?? null) : null}
              onAnswered={load}
            />
          ))}
        </ul>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">Answered</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
            {done.map((ask) => (
              <li key={ask.id} className="p-4">
                <p className="text-sm text-muted">
                  {ask.people?.name} · {ask.access_grants?.label || 'a code holder'} ·{' '}
                  {niceTime(ask.created_at)}
                </p>
                <p className="mt-1">
                  {ask.status === 'answered' ? (
                    <>
                      <span className="font-semibold">You said: </span>
                      {ask.answer}
                    </>
                  ) : (
                    <span className="font-semibold">You said you didn't recognise it.</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

type OpenAskProps = {
  ask: AskRow
  videoUrl: string | null
  onAnswered: () => void
}

// one question waiting for an answer
function OpenAsk({ ask, videoUrl, onAnswered }: OpenAskProps) {
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send(known: boolean) {
    if (!supabase || sending) return
    if (known && answer.trim() === '') {
      setError('Write what it means first.')
      return
    }
    setSending(true)
    setError('')
    const { error } = await supabase.rpc('answer_ask', {
      p_ask: ask.id,
      p_answer: answer,
      p_known: known,
    })
    setSending(false)
    if (error) {
      setError(getErrorMessage(error))
      return
    }
    onAnswered()
  }

  return (
    <li className="rounded-lg border-2 border-accent bg-card p-4">
      <p className="font-semibold">
        About {ask.people?.name ?? 'your person'}, from {ask.access_grants?.label || 'a code holder'}
      </p>
      <p className="text-sm text-muted">{niceTime(ask.created_at)}</p>

      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          muted
          loop
          autoPlay
          playsInline
          className="mt-3 aspect-[4/3] w-full rounded-lg bg-ink object-cover"
        />
      ) : (
        <p className="mt-3 text-muted">Video couldn't load.</p>
      )}

      {ask.note && (
        <p className="mt-2">
          <span className="text-muted">They wrote: </span>“{ask.note}”
        </p>
      )}

      <label htmlFor={'answer-' + ask.id} className="label mt-4">
        What does it mean?
      </label>
      <textarea
        id={'answer-' + ask.id}
        rows={2}
        value={answer}
        maxLength={1000}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="e.g. That's his pain hum. Check his tummy, he gets constipated."
        className="input"
      />

      {error && (
        <p role="alert" className="mt-2 text-bad">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => send(true)} disabled={sending} className="btn flex-1">
          {sending ? 'Sending…' : 'Send answer'}
        </button>
        {/* layer 4. an honest "no" is better than a guess */}
        <button type="button" onClick={() => send(false)} disabled={sending} className="btn-secondary">
          We don't recognise it
        </button>
      </div>
    </li>
  )
}

export default Inbox
