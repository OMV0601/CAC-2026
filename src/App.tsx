import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Debug from './pages/Debug'

function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* lets keyboard users jump past the header */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-serif text-xl font-bold text-accent">
            Lexicon
          </Link>
          <Link to="/debug" className="text-sm text-muted underline">
            Status
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/debug" element={<Debug />} />
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
