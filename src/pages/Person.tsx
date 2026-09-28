import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LexiconGrid from '../components/LexiconGrid'
import { getErrorMessage } from '../lib/errors'
import { loadLexicon } from '../lib/lexicon'
import { deleteSignal } from '../lib/saveSignal'
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

        // their clips (links last 1 hour)
        const lexicon = await loadLexicon(personId, 60 * 60)
        setSignals(lexicon.signals)
        setUrls(lexicon.urls)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [personId])

  async function handleDelete(signal: Signal) {
    const ok = window.confirm('Delete "' + signal.title + '"? This can\'t be undone.')
    if (!ok) return
    try {
      await deleteSignal(signal)
      setSignals(signals.filter((s) => s.id !== signal.id))
    } catch (err) {
      window.alert("Couldn't delete: " + getErrorMessage(err))
    }
  }

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

      <div className="mt-2">
        <h1 className="font-serif text-3xl font-bold">{person.name}</h1>
        {person.about && <p className="mt-1 text-muted">{person.about}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link to={'/people/' + person.id + '/record'} className="btn">
          + Record a signal
        </Link>
        <Link to={'/people/' + person.id + '/codes'} className="btn-secondary">
          Share with a nurse or aide
        </Link>
        <Link to={'/people/' + person.id + '/log'} className="btn-secondary">
          Who looked
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
        <div className="mt-8">
          <LexiconGrid signals={signals} urls={urls} onDelete={handleDelete} />
        </div>
      )}
    </div>
  )
}

export default Person
