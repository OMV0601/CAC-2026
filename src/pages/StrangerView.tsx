import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import LexiconGrid from '../components/LexiconGrid'
import SetupChecklist from '../components/SetupChecklist'
import { ensureSignedIn } from '../lib/auth'
import { getErrorMessage } from '../lib/errors'
import { loadLexicon } from '../lib/lexicon'
import { supabase } from '../lib/supabase'
import { niceTime, type Signal } from '../lib/types'

// what claim_grant() sends back when the code works
type CodeInfo = {
  ok: true
  person_id: string
  person_name: string
  label: string | null
  expires_at: string
}

// what to say when a code doesn't work
const problems: Record<string, string> = {
  not_found: "This code doesn't work. Try scanning it again, or ask the family for a new one.",
  expired: 'This code has run out. Ask the family for a new one.',
  revoked: 'The family turned this code off.',
}

// the page a nurse/aide sees after scanning the QR code.
// NO sign in screen ever. someone at 2am with a patient will just close the tab
function StrangerView() {
  const { token } = useParams()
  const [info, setInfo] = useState<CodeInfo | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    async function open() {
      if (!supabase || !token) return
      try {
        // 1. get a user id (anonymous if they dont have one)
        await ensureSignedIn()

        // 2. trade the code for access to this one person
        const { data, error } = await supabase.rpc('claim_grant', { p_token: token })
        if (error) throw error
        if (!data.ok) {
          setProblem(problems[data.reason] ?? problems.not_found)
          return
        }
        setInfo(data as CodeInfo)

        // 3. load the clips. short links, so they stop working soon after
        // a code gets turned off
        const lexicon = await loadLexicon(data.person_id, 15 * 60)
        setSignals(lexicon.signals)
        setUrls(lexicon.urls)
      } catch (err) {
        const message = getErrorMessage(err)
        // the most likely setup mistake gets its own message
        if (message.toLowerCase().includes('anonymous')) {
          setProblem(
            'Guest access is turned off for this app. (For the family: turn on anonymous sign-ins in Supabase → Authentication → Sign In / Providers.)',
          )
        } else {
          setProblem(message)
        }
      } finally {
        setLoading(false)
      }
    }
    open()
  }, [token])

  if (!supabase) return <SetupChecklist />

  if (loading) return <p className="text-lg text-muted">Opening…</p>

  if (problem || !info) {
    return (
      <div className="rounded-lg border border-bad bg-card p-5">
        <h1 className="text-xl font-bold text-bad">Can't open this lexicon</h1>
        <p role="alert" className="mt-2">
          {problem || 'Something went wrong.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">How {info.person_name} communicates</h1>
      <p className="mt-2 text-lg">
        {info.person_name} can't tell you in words. These clips were recorded by the people who know
        them best, and show what their sounds and movements mean.
      </p>
      <p className="mt-2 text-sm text-muted">
        Shared by their family{info.label ? ' for ' + info.label : ''}. Works until{' '}
        {niceTime(info.expires_at)}.
      </p>

      {signals.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-card p-5 text-muted">
          The family hasn't recorded any signals yet.
        </p>
      ) : (
        <div className="mt-6">
          <LexiconGrid signals={signals} urls={urls} />
        </div>
      )}

      <p className="mt-8 border-t border-line pt-4 text-sm text-muted">
        Lexicon never guesses what something means. It only shows what the family recorded. You
        decide if a clip matches what you're seeing.
      </p>
    </div>
  )
}

export default StrangerView
