import { useState } from 'react'
import { bodyRegionNames, type BodyRegion, type Signal } from '../lib/types'
import SignalTile from './SignalTile'

type Props = {
  signals: Signal[]
  urls: Record<string, string>
}

// layer 1 (LOOK): every clip playing at once, just look until one matches
// layer 2 (POINT): tap WHERE it's happening to cut the grid down.
// no words needed for either one
function LexiconGrid({ signals, urls }: Props) {
  const [region, setRegion] = useState<BodyRegion | 'all'>('all')
  const [soundOnly, setSoundOnly] = useState(false)

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
          />
        ))}
      </ul>
    </div>
  )
}

export default LexiconGrid
