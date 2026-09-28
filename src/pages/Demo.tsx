import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ensureSignedIn } from '../lib/auth'
import { demoPersonId } from '../lib/demo'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'

// "Try the demo": gets a fresh 2 hour code for the demo person and opens it,
// exactly like a nurse scanning a real QR code
function Demo() {
  usePageTitle('Demo')
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    async function open() {
      if (!supabase || !demoPersonId) return
      try {
        await ensureSignedIn()
        const { data, error } = await supabase.rpc('open_demo', { p_person: demoPersonId })
        if (error) throw error
        navigate('/c/' + data, { replace: true })
      } catch (err) {
        setError(getErrorMessage(err))
      }
    }
    open()
  }, [navigate])

  if (!demoPersonId) {
    return (
      <p>
        The demo isn't set up yet. (For the developer: run <code>npm run seed:demo</code> and set{' '}
        <code>VITE_DEMO_PERSON_ID</code>.) <Link to="/" className="text-accent underline">Go home</Link>
      </p>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-bad bg-card p-5">
        <h1 className="text-xl font-bold text-bad">Couldn't open the demo</h1>
        <p role="alert" className="mt-2">
          {error}
        </p>
      </div>
    )
  }

  return <p className="text-lg text-muted">Opening the demo…</p>
}

export default Demo
