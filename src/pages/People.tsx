import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { Person } from '../lib/types'

// the list of people you look after, plus a form to add someone new
function People() {
  const navigate = useNavigate()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // add person form
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    async function load() {
      if (!supabase) return
      // RLS only gives back people whose circle we're in
      const { data, error } = await supabase
        .from('people')
        .select('id, name, about, created_at')
        .order('created_at', { ascending: true })
      if (error) setError(getErrorMessage(error))
      else setPeople(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setAdding(true)
    setAddError('')

    // this function makes the person AND makes us the owner (see 0005 sql)
    const { data, error } = await supabase.rpc('create_person', {
      p_name: name,
      p_about: about,
    })

    setAdding(false)
    if (error) {
      setAddError(getErrorMessage(error))
      return
    }
    // go straight to their page so they can record the first clip
    navigate('/people/' + data)
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-serif text-2xl font-bold">Your people</h1>

        {loading && <p className="mt-4 text-muted">Loading…</p>}
        {error && (
          <p role="alert" className="mt-4 text-bad">
            {error}
          </p>
        )}

        {!loading && !error && people.length === 0 && (
          <p className="mt-4 text-muted">Nobody yet. Add the person you look after below.</p>
        )}

        {people.length > 0 && (
          <ul className="mt-4 space-y-3">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  to={'/people/' + person.id}
                  className="block rounded-lg border border-line bg-card p-4 hover:border-accent"
                >
                  <span className="text-lg font-semibold">{person.name}</span>
                  {person.about && <span className="mt-1 block text-muted">{person.about}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-line bg-card p-5">
        <h2 className="text-lg font-bold">Add a person</h2>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="about" className="label">
              About them <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="about"
              rows={2}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="e.g. 9 years old, cerebral palsy, loves music"
              className="input"
            />
          </div>

          {addError && (
            <p role="alert" className="text-bad">
              {addError}
            </p>
          )}

          <button type="submit" disabled={adding} className="btn">
            {adding ? 'Adding…' : 'Add person'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default People
