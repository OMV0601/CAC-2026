import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { codeLink, niceTime, type Grant } from '../lib/types'

// how long a code can last. the database clamps it to 15 min - 7 days anyway
const lifetimes = [
  { minutes: 60, name: '1 hour' },
  { minutes: 8 * 60, name: '8 hours (one shift)' },
  { minutes: 12 * 60, name: '12 hours' },
  { minutes: 24 * 60, name: '1 day' },
  { minutes: 3 * 24 * 60, name: '3 days' },
  { minutes: 7 * 24 * 60, name: '7 days (longest)' },
]

function isActive(grant: Grant) {
  return grant.revoked_at === null && new Date(grant.expires_at) > new Date()
}

// family page for making QR codes to hand to a nurse, aide, sub, etc.
function Codes() {
  const { personId } = useParams()
  const [personName, setPersonName] = useState('')
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // new code form
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState(8 * 60)
  const [making, setMaking] = useState(false)

  // which link was just copied (to say "Copied!")
  const [copiedId, setCopiedId] = useState('')

  useEffect(() => {
    async function load() {
      if (!supabase || !personId) return
      try {
        const { data: person, error: personError } = await supabase
          .from('people')
          .select('name')
          .eq('id', personId)
          .maybeSingle()
        if (personError) throw personError
        if (!person) throw new Error("This person doesn't exist, or you're not in their circle.")
        setPersonName(person.name)

        const { data, error } = await supabase
          .from('access_grants')
          .select('id, person_id, token, label, expires_at, revoked_at, created_at')
          .eq('person_id', personId)
          .order('created_at', { ascending: false })
        if (error) throw error
        setGrants(data ?? [])
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [personId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !personId) return
    setMaking(true)
    setError('')

    const { data, error } = await supabase.rpc('create_grant', {
      p_person: personId,
      p_label: label,
      p_minutes: minutes,
    })
    setMaking(false)

    if (error) {
      setError(getErrorMessage(error))
      return
    }
    // put the new one at the top
    setGrants([data as Grant, ...grants])
    setLabel('')
  }

  async function handleRevoke(grant: Grant) {
    if (!supabase) return
    const ok = window.confirm('Turn off this code? Anyone using it loses access right away.')
    if (!ok) return

    const { error } = await supabase.rpc('revoke_grant', { p_grant: grant.id })
    if (error) {
      setError(getErrorMessage(error))
      return
    }
    // update it on screen without reloading
    setGrants(grants.map((g) => (g.id === grant.id ? { ...g, revoked_at: new Date().toISOString() } : g)))
  }

  async function handleCopy(grant: Grant) {
    try {
      await navigator.clipboard.writeText(codeLink(grant.token))
      setCopiedId(grant.id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.")
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>

  const active = grants.filter(isActive)
  const old = grants.filter((g) => !isActive(g))

  return (
    <div className="space-y-8">
      <div>
        <Link to={'/people/' + personId} className="text-sm text-muted underline">
          ← Back to {personName || 'person'}
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold">Share {personName}'s lexicon</h1>
        <p className="mt-1 text-muted">
          Make a code for a nurse, aide or sub. They scan it and see every clip. No account needed.
          Codes run out on their own, and you can turn one off any time.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-line bg-card p-5">
        <h2 className="text-lg font-bold">Make a new code</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label htmlFor="label" className="label">
              Who is it for?
            </label>
            <input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Overlake ER, night shift"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="lifetime" className="label">
              How long should it work?
            </label>
            <select
              id="lifetime"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="input"
            >
              {lifetimes.map((l) => (
                <option key={l.minutes} value={l.minutes}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={making} className="btn">
            {making ? 'Making…' : 'Make code'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-bold">Working codes</h2>
        {active.length === 0 && <p className="mt-2 text-muted">None right now.</p>}

        <ul className="mt-3 space-y-4">
          {active.map((grant) => (
            <li key={grant.id} className="rounded-lg border border-line bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* white box around the QR so phones can scan it */}
                <div className="self-start rounded bg-white p-2">
                  <QRCodeSVG
                    value={codeLink(grant.token)}
                    size={160}
                    role="img"
                    aria-label={'QR code for ' + (grant.label || 'this code')}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{grant.label || 'No label'}</p>
                  <p className="text-muted">Works until {niceTime(grant.expires_at)}</p>
                  <p className="mt-2 text-sm wrap-anywhere text-muted">{codeLink(grant.token)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleCopy(grant)} className="btn-secondary">
                      {copiedId === grant.id ? 'Copied!' : 'Copy link'}
                    </button>
                    <button type="button" onClick={() => handleRevoke(grant)} className="btn-danger">
                      Turn off
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {old.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">Old codes</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
            {old.map((grant) => (
              <li key={grant.id} className="flex justify-between gap-4 p-3">
                <span>{grant.label || 'No label'}</span>
                <span className="text-muted">
                  {grant.revoked_at ? 'Turned off ' + niceTime(grant.revoked_at) : 'Ran out ' + niceTime(grant.expires_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default Codes
