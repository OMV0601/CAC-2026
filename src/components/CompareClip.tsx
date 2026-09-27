import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { flaccNames, type Signal } from '../lib/types'
import ClipRecorder, { type RecordedClip } from './ClipRecorder'

type Props = {
  signal: Signal
  familyUrl: string | null
  onClose: () => void
}

type Stage = 'recording' | 'compare' | 'matched'

// side by side confirming.
// the stranger films 3 seconds of what they see, and it plays right next to
// the family's clip. THEY decide if it's the same. the app never decides
function CompareClip({ signal, familyUrl, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('recording')
  const [myUrl, setMyUrl] = useState('')
  const [logFailed, setLogFailed] = useState(false)

  // free the memory for our clip when we're done
  useEffect(() => {
    return () => {
      if (myUrl) URL.revokeObjectURL(myUrl)
    }
  }, [myUrl])

  function handleClip(clip: RecordedClip) {
    // this clip never gets uploaded. it only lives on this phone
    setMyUrl(URL.createObjectURL(clip.blob))
    setStage('compare')
  }

  async function decide(matched: boolean) {
    // write down what they decided, so the family can see it later.
    // if this fails we still show the answer, care comes first
    if (supabase) {
      const { error } = await supabase.rpc('log_confirmation', { p_signal: signal.id, p_matched: matched })
      if (error) setLogFailed(true)
    }
    if (matched) setStage('matched')
    else onClose()
  }

  return (
    <section className="rounded-lg border-2 border-accent bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">Is it this one? “{signal.title}”</h2>
        <button type="button" onClick={onClose} className="shrink-0 text-muted underline">
          Close
        </button>
      </div>

      {stage === 'recording' && (
        <>
          <p className="mt-1">Film 3 seconds of what you're seeing. It stays on this phone.</p>
          <div className="mt-3">
            <ClipRecorder maxSeconds={3} doneLabel="Compare side by side" onDone={handleClip} />
          </div>
        </>
      )}

      {stage === 'compare' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <figure>
              <video
                src={myUrl}
                muted
                loop
                autoPlay
                playsInline
                aria-label="What you filmed"
                className="aspect-square w-full rounded-lg bg-ink object-cover"
              />
              <figcaption className="mt-1 text-center font-semibold">What you see</figcaption>
            </figure>
            <figure>
              {familyUrl ? (
                <video
                  src={familyUrl}
                  muted
                  loop
                  autoPlay
                  playsInline
                  aria-label={"Family's clip: " + signal.title}
                  className="aspect-square w-full rounded-lg bg-ink object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg bg-ink text-accent-ink">
                  Video couldn't load
                </div>
              )}
              <figcaption className="mt-1 text-center font-semibold">Family's clip</figcaption>
            </figure>
          </div>

          <p className="mt-4 text-lg font-semibold">Is it the same thing?</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => decide(true)} className="btn flex-1">
              Yes, same thing
            </button>
            <button type="button" onClick={() => decide(false)} className="btn-secondary flex-1">
              No, not this one
            </button>
          </div>
        </>
      )}

      {stage === 'matched' && (
        <div aria-live="assertive" className="mt-3">
          <p className="text-sm font-semibold text-good">✓ You confirmed a match</p>
          <p className="mt-2 font-serif text-2xl font-bold">{signal.meaning}</p>
          {signal.action && (
            <p className="mt-2 text-lg">
              <span className="font-semibold">What to do: </span>
              {signal.action}
            </p>
          )}
          {signal.flacc_category && (
            <p className="mt-2 font-semibold text-bad">
              This is a pain sign (FLACC: {flaccNames[signal.flacc_category]}).
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            {logFailed ? "Couldn't save this to the family's log." : 'Saved to the family’s log.'}
          </p>
        </div>
      )}
    </section>
  )
}

export default CompareClip
