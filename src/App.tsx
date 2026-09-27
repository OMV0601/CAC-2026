import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import { isFamily, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import Codes from './pages/Codes'
import Debug from './pages/Debug'
import Home from './pages/Home'
import People from './pages/People'
import Person from './pages/Person'
import RecordSignal from './pages/RecordSignal'
import SignIn from './pages/SignIn'
import StrangerView from './pages/StrangerView'

function App() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // strangers with a code get a plain header with no sign in stuff.
  // a nurse should never be pushed toward making an account
  const isStranger = location.pathname.startsWith('/c/')

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* lets keyboard users jump past the header */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-line bg-card">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          {isStranger ? (
            <span className="font-serif text-xl font-bold text-accent">Lexicon</span>
          ) : (
            <Link to="/" className="font-serif text-xl font-bold text-accent">
              Lexicon
            </Link>
          )}

          {!isStranger && (
            <div className="flex items-center gap-4 text-sm">
              {isFamily(session) ? (
                <>
                  <Link to="/people" className="text-muted underline">
                    People
                  </Link>
                  <button type="button" onClick={signOut} className="text-muted underline">
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/signin" className="text-muted underline">
                  Sign in
                </Link>
              )}
              <Link to="/debug" className="text-muted underline">
                Status
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/debug" element={<Debug />} />

          {/* the stranger page. NOT behind sign in on purpose */}
          <Route path="/c/:token" element={<StrangerView />} />

          {/* family only pages */}
          <Route
            path="/people"
            element={
              <RequireAuth>
                <People />
              </RequireAuth>
            }
          />
          <Route
            path="/people/:personId"
            element={
              <RequireAuth>
                <Person />
              </RequireAuth>
            }
          />
          <Route
            path="/people/:personId/record"
            element={
              <RequireAuth>
                <RecordSignal />
              </RequireAuth>
            }
          />

          <Route
            path="/people/:personId/codes"
            element={
              <RequireAuth>
                <Codes />
              </RequireAuth>
            }
          />

          <Route
            path="*"
            element={
              <p>
                Page not found. <Link to="/" className="text-accent underline">Go home</Link>
              </p>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
