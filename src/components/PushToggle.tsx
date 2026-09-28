import { useEffect, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { isPushOn, pushSupported, turnOffPush, turnOnPush } from '../lib/push'

// "turn on phone alerts" box for the inbox
function PushToggle() {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    isPushOn()
      .then(setOn)
      .catch(() => setOn(false))
  }, [])

  async function toggle() {
    setBusy(true)
    setError('')
    try {
      if (on) {
        await turnOffPush()
        setOn(false)
      } else {
        await turnOnPush()
        setOn(true)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <p className="font-semibold">{on ? '🔔 Alerts are on for this device' : 'Get an alert when someone asks'}</p>
      <p className="mt-1 text-sm text-muted">
        {on
          ? "Your phone buzzes even when Lexicon isn't open."
          : pushSupported()
            ? "So you don't have to keep this page open."
            : 'On iPhone: tap Share → Add to Home Screen, open Lexicon from there, then turn this on.'}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-bad">
          {error}
        </p>
      )}
      {pushSupported() && (
        <button type="button" onClick={toggle} disabled={busy} className={(on ? 'btn-secondary' : 'btn') + ' mt-3'}>
          {busy ? 'One sec…' : on ? 'Turn off alerts' : 'Turn on alerts'}
        </button>
      )}
    </section>
  )
}

export default PushToggle
