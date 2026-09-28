import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { niceTime } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'

type LogRow = {
  id: number
  action: string
  detail: string | null
  created_at: string
  access_grants: { label: string | null } | null
}

// turns the action codes into normal words
function describe(row: LogRow) {
  if (row.action === 'opened_code') return 'Opened the lexicon'
  if (row.action === 'asked') return 'Asked the family a question' + (row.detail ? ': “' + row.detail + '”' : '')
  if (row.action === 'confirmed_match') return 'Confirmed a match: ' + (row.detail ?? '')
  if (row.action === 'not_a_match') return 'Compared, not a match: ' + (row.detail ?? '')
  return row.action
}

// every time someone with a code looked, asked or confirmed something.
// the family can see exactly who looked. nobody can fake or delete these
// (only the database functions can write here, see 0001 and 0003)
function AccessLog() {
  usePageTitle('Who looked')
  const { personId } = useParams()
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!supabase || !personId) return
      const { data, error } = await supabase
        .from('access_log')
        .select('id, action, detail, created_at, access_grants(label)')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) setError(getErrorMessage(error))
      else setRows((data ?? []) as unknown as LogRow[])
      setLoading(false)
    }
    load()
  }, [personId])

  return (
    <div>
      <Link to={'/people/' + personId} className="text-sm text-muted underline">
        ← Back
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-bold">Who looked</h1>
      <p className="mt-1 text-muted">Everything that happened through a shared code, newest first.</p>

      {loading && <p className="mt-4 text-muted">Loading…</p>}
      {error && (
        <p role="alert" className="mt-4 text-bad">
          {error}
        </p>
      )}
      {!loading && !error && rows.length === 0 && <p className="mt-4 text-muted">Nobody has used a code yet.</p>}

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-card">
          {rows.map((row) => (
            <li key={row.id} className="p-3">
              <p className={row.action === 'confirmed_match' ? 'font-semibold text-good' : ''}>{describe(row)}</p>
              <p className="text-sm text-muted">
                {niceTime(row.created_at)} · {row.access_grants?.label || 'a code'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AccessLog
