import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import SetupChecklist from '../components/SetupChecklist'
import { isFamily, useAuth } from '../lib/auth'
import { getErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

// sign in and sign up are the same form, just a different button
function SignIn() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // where to go after signing in (RequireAuth saves this for us)
  const from = (location.state as { from?: string } | null)?.from ?? '/people'

  if (!supabase) return <SetupChecklist />

  // already signed in? skip this page
  if (isFamily(session)) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(from, { replace: true })
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          navigate(from, { replace: true })
        } else {
          // this happens when "Confirm email" is turned on in supabase
          setMessage('Account made! Check your email for a link to confirm it, then sign in.')
        }
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-2xl font-bold">
        {mode === 'signin' ? 'Sign in' : 'Make an account'}
      </h1>
      <p className="mt-2 text-muted">For family and caregivers. Nurses with a code don't need this.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {mode === 'signup' && <p className="mt-1 text-sm text-muted">At least 6 characters.</p>}
        </div>

        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-good">
            {message}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn w-full">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Make account'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError('')
          setMessage('')
        }}
        className="mt-4 text-accent underline"
      >
        {mode === 'signin' ? "Don't have an account? Make one" : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}

export default SignIn
