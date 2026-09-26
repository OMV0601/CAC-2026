import { Link, Navigate } from 'react-router-dom'
import SetupChecklist from '../components/SetupChecklist'
import { isFamily, useAuth } from '../lib/auth'
import { isConfigured } from '../lib/supabase'

function Home() {
  const { session, loading } = useAuth()

  // family members go straight to their people
  if (!loading && isFamily(session)) return <Navigate to="/people" replace />

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-serif text-3xl font-bold">A dictionary for someone who can't speak</h1>
        <p className="mt-3 text-lg text-muted">
          Families record the sounds and movements only they understand. A nurse or aide who has
          never met the person scans a code and looks it up.
        </p>
        <p className="mt-3 text-muted">
          Lexicon never guesses what something means. It only shows what the family recorded, and
          a person decides.
        </p>
      </section>

      {/* if supabase isnt set up yet, tell them how */}
      {!isConfigured && <SetupChecklist />}

      {isConfigured && (
        <Link to="/signin" className="btn">
          Family sign in
        </Link>
      )}
    </div>
  )
}

export default Home
