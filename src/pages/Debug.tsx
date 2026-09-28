import { useEffect, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { demoPersonId } from '../lib/demo'
import { vapidPublicKey } from '../lib/push'
import { isConfigured, supabase, supabaseKey, supabaseUrl } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'

// the status board. it checks each piece of setup from INSIDE the
// running app and says what's missing, so when something breaks at 11pm
// we dont have to remember how everything is wired together

type Status = 'checking' | 'ok' | 'bad' | 'skipped'

type Check = {
  name: string
  status: Status
  detail: string
}

// the 8 tables that 0001_tables.sql makes
const expectedTables = [
  'access_grants',
  'access_log',
  'ask_requests',
  'circle_members',
  'grant_sessions',
  'people',
  'push_subscriptions',
  'signals',
]

// what lexicon_health() sends back
type Health = {
  tables: string[]
  bucket: boolean
  bucket_public: boolean
}

async function runChecks(): Promise<Check[]> {
  const results: Check[] = []

  // 1 + 2: are the env variables there?
  results.push({
    name: 'VITE_SUPABASE_URL',
    status: supabaseUrl ? 'ok' : 'bad',
    detail: supabaseUrl
      ? supabaseUrl
      : 'Missing. Add it to .env.local (or Vercel env vars, then redeploy).',
  })
  results.push({
    name: 'VITE_SUPABASE_ANON_KEY',
    status: supabaseKey ? 'ok' : 'bad',
    detail: supabaseKey
      ? 'Set (starts with ' + supabaseKey.slice(0, 12) + '...)'
      : 'Missing. Add it to .env.local (or Vercel env vars, then redeploy).',
  })

  // phone alerts are a bonus, so missing = skipped, not a problem
  results.push({
    name: 'VITE_VAPID_PUBLIC_KEY',
    status: vapidPublicKey ? 'ok' : 'skipped',
    detail: vapidPublicKey
      ? 'Set. Phone alerts can work.'
      : 'Not set, so phone alerts are off. Run: npm run vapid -- you@example.com',
  })

  results.push({
    name: 'VITE_DEMO_PERSON_ID',
    status: demoPersonId ? 'ok' : 'skipped',
    detail: demoPersonId
      ? 'Set. The "Try it as a nurse" button shows on the home page.'
      : 'Not set, so there is no demo button. Run: npm run seed:demo -- email password',
  })

  // no point checking the rest without a client
  if (!isConfigured || !supabase) {
    results.push({ name: 'Database', status: 'skipped', detail: 'Fix the env variables first.' })
    return results
  }

  // 3: can we reach the database, and did the migrations run?
  let health: Health | null = null
  try {
    const { data, error } = await supabase.rpc('lexicon_health')
    if (error) {
      // PGRST202 = function doesnt exist, which means 0002 wasnt run
      if (error.code === 'PGRST202') {
        results.push({
          name: 'Database',
          status: 'bad',
          detail: 'Reached Supabase, but lexicon_health() is missing. Run the migrations in order.',
        })
      } else {
        results.push({ name: 'Database', status: 'bad', detail: getErrorMessage(error) })
      }
    } else {
      health = data as Health
      results.push({ name: 'Database', status: 'ok', detail: 'Reachable' })
    }
  } catch (err) {
    results.push({
      name: 'Database',
      status: 'bad',
      detail: "Couldn't reach Supabase. Check the URL. " + getErrorMessage(err),
    })
  }

  if (!health) {
    results.push({ name: 'Tables', status: 'skipped', detail: 'Database check failed.' })
    results.push({ name: 'Storage bucket', status: 'skipped', detail: 'Database check failed.' })
    return results
  }

  // 4: are all 8 tables there?
  const missing = expectedTables.filter((t) => !health.tables.includes(t))
  results.push({
    name: 'Tables',
    status: missing.length === 0 ? 'ok' : 'bad',
    detail:
      missing.length === 0
        ? 'All 8 tables exist'
        : 'Missing: ' + missing.join(', ') + '. Run 0001_tables.sql.',
  })

  // 5: is the "signals" bucket there and private?
  if (!health.bucket) {
    results.push({
      name: 'Storage bucket',
      status: 'bad',
      detail: 'No bucket called "signals". Storage → New bucket → name it signals, Public OFF.',
    })
  } else if (health.bucket_public) {
    results.push({
      name: 'Storage bucket',
      status: 'bad',
      detail: 'The "signals" bucket is PUBLIC. Anyone could watch the clips. Turn Public off.',
    })
  } else {
    results.push({ name: 'Storage bucket', status: 'ok', detail: '"signals" exists and is private' })
  }

  // 6: is the anon role really locked out?
  // this only means something when nobody is signed in
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session) {
    results.push({
      name: 'Anon locked out',
      status: 'skipped',
      detail: "You're signed in, so this can't be tested right now.",
    })
  } else {
    const { error } = await supabase.from('people').select('id').limit(1)
    // 42501 = permission denied, which is what we WANT here
    if (error && error.code === '42501') {
      results.push({ name: 'Anon locked out', status: 'ok', detail: "Anon can't read people" })
    } else if (error) {
      results.push({ name: 'Anon locked out', status: 'bad', detail: getErrorMessage(error) })
    } else {
      results.push({
        name: 'Anon locked out',
        status: 'bad',
        detail: 'Anon CAN read the people table. Run 0003_security.sql.',
      })
    }
  }

  return results
}

// little colored label for each row. it has words too, not just color
function StatusBadge({ status }: { status: Status }) {
  if (status === 'ok') return <span className="font-bold text-good">✓ OK</span>
  if (status === 'bad') return <span className="font-bold text-bad">✗ Problem</span>
  if (status === 'skipped') return <span className="font-bold text-muted">– Skipped</span>
  return <span className="text-muted">Checking…</span>
}

function Debug() {
  usePageTitle('Status')
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)
  // bumping this number makes the checks run again
  const [runCount, setRunCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    runChecks()
      .then((results) => {
        if (!cancelled) setChecks(results)
      })
      .catch((err) => {
        if (!cancelled) setChecks([{ name: 'Status board', status: 'bad', detail: getErrorMessage(err) }])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // if the page closes before the checks finish, ignore the results
    return () => {
      cancelled = true
    }
  }, [runCount])

  const allGood = !loading && checks.length > 0 && checks.every((c) => c.status !== 'bad')

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Status</h1>
        <button
          type="button"
          onClick={() => setRunCount(runCount + 1)}
          disabled={loading}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check again'}
        </button>
      </div>

      <p className="mt-2 text-muted" aria-live="polite">
        {loading ? 'Running checks…' : allGood ? 'Everything is set up.' : 'Something needs fixing.'}
      </p>

      <ul className="mt-5 divide-y divide-line rounded-lg border border-line bg-card">
        {checks.map((check) => (
          <li key={check.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
            <div className="w-40 shrink-0 font-semibold">{check.name}</div>
            <div className="w-28 shrink-0">
              <StatusBadge status={check.status} />
            </div>
            <div className="wrap-anywhere text-muted">{check.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Debug
