import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// keeps track of who is signed in, so every page can ask

type AuthState = {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // if supabase isnt set up there is nothing to wait for
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return

    // check if we're already signed in from last time
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // and listen for sign in / sign out after that
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// strangers with a code get an ANONYMOUS session (phase 2).
// they count as signed in to supabase but they are not family,
// so the family pages should treat them like they're signed out
export function isFamily(session: Session | null) {
  return session !== null && !session.user.is_anonymous
}

// makes sure SOMEBODY is signed in. if nobody is, signs in anonymously.
// this is how a stranger gets a real user id without making an account.
// we keep the promise around so two calls at once dont make two users
let signingIn: Promise<void> | null = null

export function ensureSignedIn(): Promise<void> {
  if (!signingIn) {
    signingIn = (async () => {
      if (!supabase) throw new Error('Supabase is not set up')
      const { data } = await supabase.auth.getSession()
      if (data.session) return
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
    })()
    // if it failed, let the next call try again
    signingIn.catch(() => {
      signingIn = null
    })
  }
  return signingIn
}
