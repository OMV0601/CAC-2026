import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isFamily, useAuth } from '../lib/auth'
import { isConfigured } from '../lib/supabase'
import SetupChecklist from './SetupChecklist'

// wrap a page in this and only signed in family members can see it.
// everyone else gets sent to the sign in page
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!isConfigured) return <SetupChecklist />
  if (loading) return <p className="text-muted">Loading…</p>

  if (!isFamily(session)) {
    // remember where they were going so we can send them back after
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export default RequireAuth
