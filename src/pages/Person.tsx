import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SignalTile from '../components/SignalTile'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { Person as PersonRow, Signal } from '../lib/types'

// one person's page: their name + the grid of every clip (their "lexicon")
function Person() {
  const { personId } = useParams()
  const [person, setPerson] = useState<PersonRow | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  // storage path -> temporary link we can actually play
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!supabase || !personId) return
      setLoading(true)
      setError('')

      try {
        // the person
        const { data: personData, error: personError } = await supabase
          .from('people')
          .select('id, name, about, created_at')
          .eq('id', personId)
          .maybeSingle()
        if (personError) throw personError
        if (!personData) {
          setError("This person doesn't exist, or you're not in their circle.")
          return
        }
        setPerson(personData)

        // their clips
        const { data: signalData, error: signalError } = await supabase
          .from('signals')
          .select('*')
          .eq('person_id', personId)
          .order('created_at', { ascending: true })
        if (signalError) throw signalError
        const list = (signalData ?? []) as Signal[]
        setSignals(list)

        // the bucket is private, so we ask for links that work for 1 hour
        const paths: string[] = []
        for (const s of list) {
          paths.push(s.video_path)
          if (s.poster_path) paths.push(s.poster_path)
        }
        if (paths.length > 0) {
          const { data: signed, error: signError } = await supabase.storage
            .from('signals')
            .createSignedUrls(paths, 60 * 60)
          if (signError) throw signError
          const map: Record<string, string> = {}
          for (const item of signed ?? []) {
            if (item.path && item.signedUrl) map[item.path] = item.signedUrl
          }
          setUrls(map)
        }
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [personId])

  if (loading) return <p className="text-muted">Loading…</p>

  if (error) {
    return (
      <div>
        <p role="alert" className="text-bad">
          {error}
        </p>
        <Link to="/people" className="mt-4 inline-block text-accent underline">
          Back to your people
        </Link>
      </div>
    )
  }

  if (!person) return null

  return (
    <div>
      <Link to="/people" className="text-sm text-muted underline">
        ← Your people
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">{person.name}</h1>
          {person.about && <p className="mt-1 text-muted">{person.about}</p>}
        </div>
        <Link to={'/people/' + person.id + '/record'} className="btn">
          + Record a signal
        </Link>
      </div>

      {signals.length === 0 ? (
        <div className="mt-8 rounded-lg border border-line bg-card p-6 text-center">
          <p className="text-lg font-semibold">No signals yet</p>
          <p className="mt-1 text-muted">
            Record the first thing {person.name} does that a stranger wouldn't understand.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-muted">
            {signals.length} {signals.length === 1 ? 'signal' : 'signals'}. Every clip plays at once, so
            you can just look until one matches.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {signals.map((signal) => (
              <SignalTile
                key={signal.id}
                signal={signal}
                videoUrl={urls[signal.video_path] ?? null}
                posterUrl={signal.poster_path ? (urls[signal.poster_path] ?? null) : null}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default Person
