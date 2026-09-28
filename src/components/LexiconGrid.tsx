import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bodyRegionNames, type BodyRegion, type Signal } from '../lib/types'
import SignalTile from './SignalTile'

type Props = {
  signals: Signal[]
  urls: Record<string, string>
  // only on the stranger page, for side by side comparing
  onPick?: (signal: Signal) => void
  // only on the family page
  onDelete?: (signal: Signal) => void
}

// layer 1 (LOOK): every clip playing at once, just look until one matches
// layer 2 (POINT): tap WHERE it's happening to cut the grid down.
// no words needed for either one
function LexiconGrid({ signals, urls, onPick, onDelete }: Props) {
  const [region, setRegion] = useState<BodyRegion | 'all'>('all')
  const [soundOnly, setSoundOnly] = useState(false)
  // typing is the LAST resort (strangers often dont have the words),
  // so the search box comes after the point buttons
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<string[]>([])

  const personId = signals[0]?.person_id

  // full text search in the database (it knows "hums" and "humming" are
  // the same word). waits a moment after typing stops before searching
  useEffect(() => {
    const q = query.trim()
    if (!supabase || !personId || q === '') {
      setSearchHits([])
      return
    }
    const client = supabase
    const timer = window.setTimeout(async () => {
      const { data } = await client
        .from('signals')
        .select('id')
        .eq('person_id', personId)
        .textSearch('search', q, { type: 'websearch', config: 'english' })
      setSearchHits((data ?? []).map((row) => row.id))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, personId])

  // does a signal match what was typed? the database search, OR the words
  // just appear somewhere (so half typed words like "roc" still work)
  function matchesQuery(s: Signal) {
    const q = query.trim().toLowerCase()
    if (q === '') return true
    if (searchHits.includes(s.id)) return true
    const text = (s.title + ' ' + s.meaning + ' ' + (s.action ?? '')).toLowerCase()
    return text.includes(q)
  }

  // only offer filters that would actually show something.
  // a filter that gives zero results is a dead end and wastes time
  const regionsWithClips = (Object.keys(bodyRegionNames) as BodyRegion[]).filter((r) =>
    signals.some((s) => s.body_region === r),
  )
  const anyWithSound = signals.some((s) => s.has_sound)

  // sound is its own switch, not a body region, because someone can hum
  // while rocking. so "sound" narrows WITHIN whatever region is picked
  const shown = signals.filter((s) => {
    if (region !== 'all' && s.body_region !== region) return false
    if (soundOnly && !s.has_sound) return false
    if (!matchesQuery(s)) return false
    return true
  })

  // the sound switch only makes sense if it would leave something
  const soundWouldHelp = signals.some(
    (s) => s.has_sound && (region === 'all' || s.body_region === region),
  )

  function chipClass(active: boolean) {
    return (
      'rounded-full border px-4 py-2 font-semibold ' +
      (active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-card text-ink')
    )
  }

  return (
    <div>
      {/* only bother with filters if there's more than one kind of clip */}
      {(regionsWithClips.length > 1 || anyWithSound) && (
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="font-semibold">Where is it happening?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={region === 'all'}
              onClick={() => setRegion('all')}
              className={chipClass(region === 'all')}
            >
              Show all
            </button>
            {regionsWithClips.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={region === r}
                onClick={() => {
                  setRegion(r)
                  // if sound would leave nothing in this region, turn it off
                  if (!signals.some((s) => s.has_sound && s.body_region === r)) setSoundOnly(false)
                }}
                className={chipClass(region === r)}
              >
                {bodyRegionNames[r]}
              </button>
            ))}
            {anyWithSound && soundWouldHelp && (
              <button
                type="button"
                aria-pressed={soundOnly}
                onClick={() => setSoundOnly(!soundOnly)}
                className={chipClass(soundOnly)}
              >
                🔊 It's a sound
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="lexicon-search" className="label">
          Or type what you see <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="lexicon-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. hum, rocking, hand"
          className="input"
        />
      </div>

      <p className="mt-4 text-muted" aria-live="polite">
        Showing {shown.length} of {signals.length}. Watch until one matches what you're seeing.
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((signal) => (
          <SignalTile
            key={signal.id}
            signal={signal}
            videoUrl={urls[signal.video_path] ?? null}
            posterUrl={signal.poster_path ? (urls[signal.poster_path] ?? null) : null}
            onPick={onPick ? () => onPick(signal) : undefined}
            onDelete={onDelete ? () => onDelete(signal) : undefined}
          />
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="mt-2 rounded-lg border border-line bg-card p-4">
          Nothing matches. Try "Show all", or clear the search.
        </p>
      )}
    </div>
  )
}

export default LexiconGrid
