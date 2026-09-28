import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import SetupChecklist from '../components/SetupChecklist'
import { isFamily, useAuth } from '../lib/auth'
import { getAuthErrorMessage } from '../lib/authErrors'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'

// sign in and sign up are the same form, just a different button
function SignIn() {
  usePageTitle('Sign in')
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // where to go after signing in (RequireAuth saves this for us).
  // only allow paths inside our own app, never some other website
  const saved = (location.state as { from?: string } | null)?.from
  const from = saved && saved.startsWith('/') && !saved.startsWith('//') ? saved : '/people'

  if (!supabase) return <SetupChecklist />

  // already signed in? skip this page
  if (isFamily(session)) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return

    // " Om@Gmail.com " and "om@gmail.com" should be the same account
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.includes('@')) {
      setError("That doesn't look like a real email address.")
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      // if this browser opened a nurse code before, it has a guest session.
      // get rid of it so the family account starts clean
      if (session && session.user.is_anonymous) {
        await supabase.auth.signOut({ scope: 'local' })
      }

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) throw error
        navigate(from, { replace: true })
      } else {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password })
        if (error) throw error

        if (data.session) {
          navigate(from, { replace: true })
        } else if (data.user && data.user.identities && data.user.identities.length === 0) {
          // supabase does this (no error, no identities) when the email is
          // already taken and "Confirm email" is on
          setError('That email already has an account. Sign in instead.')
        } else {
          // "Confirm email" is on in supabase, so they need to click the link
          setMessage('Account made! Check your email for a link to confirm it, then sign in.')
        }
      }
    } catch (err) {
      setError(getAuthErrorMessage(err))
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
            minLength={mode === 'signup' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {mode === 'signup' && <p className="mt-1 text-sm text-muted">At least 8 characters.</p>}
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
