import { QRCodeSVG } from 'qrcode.react'
import { DemoVideo, ease, useDemoTime } from './clock'
import { allSignals, momAnswer, qrLink, rockSignal, unknownClip } from './data'
import Phone, { Screen } from './Phone'
import { AppBar, Camera, Pill, Tile } from './parts'
import type { DemoState } from './script'

// the "phone camera" look for the nurse's own clips: a bit zoomed, tilted and
// darker, so it doesn't look like the family's clip
const nurseCamera = { transform: 'scale(1.3) rotate(-4deg)', filter: 'brightness(0.92) contrast(1.05) sepia(0.12)' }

// the nurse's phone in the guided demo
function NursePhone({ state }: { state: DemoState }) {
  const { t } = useDemoTime()
  const n = state.nurse
  const s = n.screen
  let screen = null

  if (s === 'idle') {
    screen = (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-[#1c2a33] to-[#0e1418] text-white">
        <p className="text-6xl font-light">2:14</p>
        <p className="mt-2 text-sm opacity-80">Overlake ER · night shift</p>
      </div>
    )
  }

  if (s === 'scanner') {
    const scanned = n.scanned
    // the scan line moves up and down until it finds the code
    const line = 30 + ((Math.sin(t * 3) + 1) / 2) * 220
    screen = (
      <Screen at={n.screenAt}>
        <div className="relative h-full bg-[#2a2622]">
          {/* the printed card with the QR code, on Sam's bag */}
          <div className="absolute top-[150px] left-1/2 w-[230px] -translate-x-1/2 rotate-[-6deg] rounded-xl bg-white p-4 text-center shadow-2xl">
            <p className="font-serif text-lg font-bold text-accent">Lexicon</p>
            <p className="text-[11px] text-muted">Sam can't speak. Scan to see how he communicates.</p>
            <div className="mt-2 inline-block">
              <QRCodeSVG value={qrLink} size={150} />
            </div>
          </div>
          {/* the scanning frame */}
          <div className="absolute top-[170px] left-1/2 h-[270px] w-[270px] -translate-x-1/2 rounded-3xl border-4 border-white/80" />
          {!scanned && <div className="absolute left-[60px] right-[60px] h-[3px] bg-warn" style={{ top: 170 + line }} />}
          {scanned && (
            <div data-demo="nurse-open" className="absolute inset-x-6 bottom-24 rounded-2xl bg-white/95 p-3 text-center shadow-xl">
              <p className="text-[12px] text-muted">cac-2026-8j6b.vercel.app</p>
              <p className="font-bold text-accent">Open Sam's lexicon</p>
            </div>
          )}
          <p className="absolute inset-x-0 bottom-8 text-center text-sm text-white/80">Camera</p>
        </div>
      </Screen>
    )
  }

  if (s === 'grid') {
    const shown = allSignals.filter((sig) => {
      if (n.region !== 'all' && sig.body_region !== n.region) return false
      if (n.sound && !sig.has_sound) return false
      return true
    })
    const single = shown.length === 1
    screen = (
      <Screen at={n.screenAt}>
        <AppBar right="no account needed" />
        <div className="px-4 pt-3">
          <h2 className="font-serif text-2xl leading-tight font-bold">How Sam communicates</h2>
          <p className="text-[12px] text-muted">Shared by his family (Respite weekend)</p>
          <div className="mt-3 rounded-lg border border-line bg-card p-2.5">
            <p className="text-[13px] font-semibold">Where is it happening?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Pill on={n.region === 'all' && !n.sound}>Show all</Pill>
              <Pill>Hands</Pill>
              <Pill>Face</Pill>
              <Pill on={n.region === 'whole_body'} demo="chip-whole_body">Whole body</Pill>
              <Pill on={n.sound} demo="chip-sound">🔊 It's a sound</Pill>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Showing {shown.length} of {allSignals.length}
          </p>
          <div className={'mt-2 grid gap-2 ' + (single ? 'grid-cols-1 px-8' : 'grid-cols-2')}>
            {shown.map((sig) => (
              <Tile key={sig.id} signal={sig} big={single} demo={single ? 'nurse-compare' : undefined} />
            ))}
          </div>
        </div>
      </Screen>
    )
  }

  if (s === 'compare-camera') {
    screen = (
      <Screen at={n.screenAt}>
        <AppBar right="Compare" />
        <div className="px-5 pt-4">
          <p className="text-[15px] font-bold">Is it this one? “Rocks and hums, low”</p>
          <p className="mb-3 text-[13px] text-muted">Film 3 seconds. It stays on this phone.</p>
          <Camera recAt={n.recAt} max={3} demo="nurse-rec">
            <DemoVideo src={rockSignal.video_path} startAt={n.screenAt + 0.7} className="h-full w-full object-cover" style={nurseCamera} />
          </Camera>
        </div>
      </Screen>
    )
  }

  if (s === 'side-by-side' || s === 'matched') {
    screen = (
      <Screen at={s === 'side-by-side' ? n.screenAt : 0}>
        <AppBar right="Compare" />
        <div className="px-4 pt-4">
          <p className="text-[15px] font-bold">Is it this one? “Rocks and hums, low”</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <div className="aspect-square overflow-hidden rounded-lg bg-ink">
                <DemoVideo src={rockSignal.video_path} startAt={0.7} className="h-full w-full object-cover" style={nurseCamera} />
              </div>
              <p className="mt-1 text-center text-[13px] font-semibold">What you see</p>
            </div>
            <div>
              <div className="aspect-square overflow-hidden rounded-lg bg-ink">
                <DemoVideo src={rockSignal.video_path} className="h-full w-full object-cover" />
              </div>
              <p className="mt-1 text-center text-[13px] font-semibold">Family's clip</p>
            </div>
          </div>
          {s === 'side-by-side' ? (
            <>
              <p className="mt-4 text-[15px] font-semibold">Is it the same thing?</p>
              <div className="mt-2 flex gap-2">
                <span data-demo="nurse-yes" className="btn flex-1 py-2.5 text-[14px]">Yes, same thing</span>
                <span className="btn-secondary flex-1 py-2 text-[14px]">No, not this one</span>
              </div>
            </>
          ) : (
            <div className="mt-4" style={{ opacity: ease(t, n.screenAt, 0.4) }}>
              <p className="text-[13px] font-semibold text-good">✓ You confirmed a match</p>
              <p className="mt-1 font-serif text-[26px] leading-tight font-bold">{rockSignal.meaning}</p>
              <p className="mt-2 text-[14px]">
                <span className="font-semibold">What to do: </span>
                {rockSignal.action}
              </p>
              <p className="mt-2 text-[14px] font-semibold text-bad">This is a pain sign (FLACC: Cry).</p>
              <p className="mt-2 text-[12px] text-muted">Saved to the family's log.</p>
            </div>
          )}
        </div>
      </Screen>
    )
  }

  if (s === 'ask-intro') {
    screen = (
      <Screen at={n.screenAt}>
        <AppBar right="no account needed" />
        <div className="px-4 pt-3">
          <h2 className="font-serif text-2xl leading-tight font-bold">How Sam communicates</h2>
          <div className="mt-3 grid grid-cols-3 gap-1.5 opacity-50">
            {allSignals.map((sig) => (
              <div key={sig.id} className="aspect-square overflow-hidden rounded bg-ink">
                <DemoVideo src={sig.video_path} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border-2 border-accent bg-card p-4">
            <p className="text-lg font-bold">None of these match?</p>
            <p className="mt-1 text-[13px]">
              Film 5 seconds of what Sam is doing. It goes straight to his family, and their answer shows up right here.
            </p>
            <span data-demo="nurse-ask" className="btn mt-3 w-full py-2.5 text-[14px]">Ask the family</span>
          </div>
        </div>
      </Screen>
    )
  }

  if (s === 'ask-camera' || s === 'ask-review') {
    screen = (
      <Screen at={s === 'ask-camera' ? n.screenAt : 0}>
        <AppBar right="Ask the family" />
        <div className="px-5 pt-4">
          <p className="text-[15px] font-bold">Film what you're seeing</p>
          <p className="mb-3 text-[13px] text-muted">5 seconds. It goes to Sam's family.</p>
          {s === 'ask-camera' ? (
            <Camera recAt={n.recAt} max={5} demo="nurse-rec">
              <DemoVideo src={unknownClip.video_path} startAt={n.screenAt} className="h-full w-full object-cover" style={nurseCamera} />
            </Camera>
          ) : (
            <>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-ink">
                <DemoVideo src={unknownClip.video_path} className="h-full w-full object-cover" style={nurseCamera} />
              </div>
              <span data-demo="nurse-send" className="btn mt-4 w-full py-2.5 text-[14px]">Send to family</span>
            </>
          )}
        </div>
      </Screen>
    )
  }

  if (s === 'waiting' || s === 'answered') {
    const waited = Math.max(0, Math.floor(t - n.screenAt))
    const glow = s === 'answered' && n.answeredAt != null ? 1 - ease(t, n.answeredAt + 1.2, 1.5) : 0
    screen = (
      <Screen at={s === 'waiting' ? n.screenAt : 0}>
        <AppBar right="Ask the family" />
        <div className="px-5 pt-5">
          {s === 'waiting' ? (
            <div className="rounded-lg border-2 border-accent bg-card p-4">
              <p className="text-xl font-bold">Sent to Sam's family</p>
              <p className="mt-1 text-[14px]">Keep this page open. Their answer will show up here by itself.</p>
              <p className="mt-3 text-[14px] text-muted">Waiting 0:{String(waited).padStart(2, '0')}</p>
            </div>
          ) : (
            <div
              className="rounded-lg border-2 border-accent bg-card p-4"
              style={{
                boxShadow: `0 0 0 ${8 * glow}px rgba(23,102,58,${0.35 * glow})`,
                transform: `scale(${1 + 0.04 * glow})`,
                opacity: ease(t, n.answeredAt ?? 0, 0.3),
              }}
            >
              <p className="text-[13px] font-semibold text-good">✓ The family answered</p>
              <p className="mt-2 font-serif text-[24px] leading-tight font-bold">{momAnswer}</p>
              <p className="mt-3 text-[12px] text-muted">It showed up by itself. Nobody had to tap anything.</p>
            </div>
          )}
        </div>
      </Screen>
    )
  }

  if (s === 'honest-no') {
    screen = (
      <Screen at={n.screenAt}>
        <AppBar right="Ask the family" />
        <div className="px-5 pt-5">
          <div className="rounded-lg border-2 border-accent bg-card p-4">
            <p className="text-xl font-bold">The family doesn't recognise this one</p>
            <p className="mt-2 text-[14px]">
              That's a real answer, not a guess. It isn't one of Sam's known signals, so use your normal judgement.
            </p>
          </div>
          <p className="mt-4 text-center text-[13px] text-muted">An honest “we don't know” beats a confident wrong answer.</p>
        </div>
      </Screen>
    )
  }

  if (s === 'revoked') {
    screen = (
      <Screen at={n.screenAt}>
        <AppBar />
        <div className="px-5 pt-6">
          <div className="rounded-lg border-2 border-bad bg-card p-4">
            <p className="text-xl font-bold text-bad">Can't open this lexicon</p>
            <p className="mt-2 text-[14px]">The family turned this code off.</p>
          </div>
          <p className="mt-4 text-center text-[13px] text-muted">The clips stop working the moment the code is turned off.</p>
        </div>
      </Screen>
    )
  }

  return (
    <Phone label="Nurse" sublabel="Overlake ER · never met Sam" active={state.active !== 'mom'}>
      {screen}
    </Phone>
  )
}

export default NursePhone
