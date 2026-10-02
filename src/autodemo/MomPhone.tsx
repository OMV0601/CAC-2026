import { QRCodeSVG } from 'qrcode.react'
import { DemoVideo, ease, useDemoTime } from './clock'
import { allSignals, momAnswer, otherSignals, qrLink, rockSignal, unknownClip } from './data'
import Phone, { Screen } from './Phone'
import { AppBar, Camera, Field, Pill, Tile } from './parts'
import { typedAt, type DemoState, type Script } from './script'

// mom's phone in the guided demo
function MomPhone({ state, script }: { state: DemoState; script: Script }) {
  const { t } = useDemoTime()
  const m = state.mom
  const typed = (field: string) => typedAt(script, field, t)
  const isTyping = (field: string, full: string) => {
    const now = typed(field)
    return now.length > 0 && now.length < full.length
  }

  // the notification slides down from the top
  let overlay = null
  if (m.notifAt != null) {
    const k = ease(t, m.notifAt, 0.35)
    overlay = (
      <div
        data-demo="mom-notif"
        className="absolute inset-x-3 top-3 z-20 rounded-2xl bg-white/95 p-3 shadow-xl"
        style={{ transform: `translateY(${(k - 1) * 120}px)`, opacity: k }}
      >
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-accent font-serif text-[11px] font-bold text-white">L</span>
          LEXICON · now
        </div>
        <p className="mt-1 text-[14px] font-bold">Someone needs help reading Sam</p>
        <p className="text-[13px]">A nurse at Overlake ER sent a 5-second clip. Tap to answer.</p>
      </div>
    )
  }

  let screen = null
  const s = m.screen

  if (s === 'home' || s === 'home-new') {
    const list = s === 'home' ? otherSignals : allSignals
    const glow = s === 'home-new' ? 1 - ease(t, m.screenAt + 1.5, 1) : 0
    screen = (
      <Screen at={m.screenAt}>
        <AppBar right="People · Inbox" />
        <div className="px-5 pt-4">
          <h2 className="font-serif text-3xl font-bold">Sam</h2>
          <p className="text-[13px] text-muted">12 · doesn't speak · loves music</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span data-demo="mom-record" className="btn px-3 py-2 text-[13px]">+ Record a signal</span>
            <span data-demo="mom-share" className="btn-secondary px-3 py-1.5 text-[13px]">Share with a nurse</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {list.map((sig) => (
              <Tile key={sig.id} signal={sig} glow={sig.id === 'rock' ? glow : 0} />
            ))}
          </div>
        </div>
      </Screen>
    )
  }

  if (s === 'camera') {
    screen = (
      <Screen at={m.screenAt}>
        <AppBar right="Record a signal" />
        <div className="px-5 pt-4">
          <p className="mb-3 text-[13px] text-muted">Film one thing Sam does. Then say what it means.</p>
          <Camera recAt={m.recAt} max={15} demo="mom-rec">
            <DemoVideo src={rockSignal.video_path} startAt={m.screenAt} className="h-full w-full object-cover" />
          </Camera>
        </div>
      </Screen>
    )
  }

  if (s === 'label') {
    screen = (
      <Screen at={m.screenAt}>
        <AppBar right="Record a signal" />
        <div className="space-y-3 px-5 pt-3">
          <div className="mx-auto h-[120px] w-[120px] overflow-hidden rounded-lg bg-ink">
            <DemoVideo src={rockSignal.video_path} className="h-full w-full object-cover" />
          </div>
          <Field
            label="What does it look like?"
            value={typed('title')}
            placeholder="e.g. Rocks forward and hums low"
            typing={isTyping('title', 'Rocks and hums, low')}
          />
          <Field
            label="What does it mean?"
            value={typed('meaning')}
            placeholder="e.g. Tummy pain"
            typing={isTyping('meaning', 'Pain, usually his stomach')}
          />
          <div>
            <p className="mb-1 text-[13px] font-semibold">Where on the body?</p>
            <div className="flex flex-wrap gap-1.5">
              <Pill>Hands</Pill>
              <Pill>Face</Pill>
              <Pill>Legs</Pill>
              <Pill on={m.region} demo="mom-region">Whole body</Pill>
            </div>
          </div>
          <div data-demo="mom-sound" className="flex items-center gap-2 text-[14px]">
            <span className={'flex h-5 w-5 items-center justify-center rounded border-2 ' + (m.sound ? 'border-accent bg-accent text-white' : 'border-line bg-card')}>
              {m.sound ? '✓' : ''}
            </span>
            It makes a sound
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold">Is it a pain sign?</p>
            <div data-demo="mom-pain" className={'rounded-md border px-3 py-2 text-[14px] ' + (m.pain ? 'border-bad bg-card font-semibold text-bad' : 'border-line bg-card text-muted')}>
              {m.pain ? 'Yes: Cry (FLACC pain scale)' : 'No / not sure'}
            </div>
          </div>
          <div data-demo="mom-save" className="btn w-full py-2.5 text-[14px]">Save signal</div>
        </div>
      </Screen>
    )
  }

  if (s === 'code-form' || s === 'code-made') {
    const made = s === 'code-made'
    const qrIn = made ? ease(t, m.screenAt, 0.5) : 0
    screen = (
      <Screen at={s === 'code-form' ? m.screenAt : 0}>
        <AppBar right="Share codes" />
        <div className="space-y-3 px-5 pt-4">
          <h2 className="font-serif text-2xl font-bold">Share Sam's lexicon</h2>
          <p className="text-[13px] text-muted">No account needed. Codes run out on their own.</p>
          {!made && (
            <>
              <Field label="Who is it for?" value={typed('codeLabel')} placeholder="e.g. Respite weekend" typing={isTyping('codeLabel', 'Respite weekend')} />
              <div>
                <p className="mb-1 text-[13px] font-semibold">How long should it work?</p>
                <div className="flex flex-wrap gap-1.5">
                  <Pill>8 hours</Pill>
                  <Pill>1 day</Pill>
                  <Pill on={m.threeDays} demo="mom-3d">3 days</Pill>
                </div>
              </div>
              <div data-demo="mom-make" className="btn w-full py-2.5 text-[14px]">Make code</div>
            </>
          )}
          {made && (
            <div
              className="rounded-lg border border-line bg-card p-4 text-center"
              style={{ opacity: qrIn, transform: `scale(${0.9 + 0.1 * qrIn})` }}
            >
              <div className="inline-block rounded bg-white p-2">
                <QRCodeSVG value={qrLink} size={190} />
              </div>
              <p className="mt-2 text-lg font-bold">Respite weekend</p>
              <p className="text-[13px] text-muted">Works until Sunday 6 PM · then it stops by itself</p>
              <div className="mt-3 flex justify-center gap-2">
                <span className="btn-secondary px-3 py-1.5 text-[13px]">Copy link</span>
                <span className="btn-danger px-3 py-1.5 text-[13px]">Turn off</span>
              </div>
            </div>
          )}
        </div>
      </Screen>
    )
  }

  if (s === 'inbox' || s === 'answered') {
    const answer = s === 'inbox' ? typed('answer') : momAnswer
    const saved = m.savedAt != null
    screen = (
      <Screen at={s === 'inbox' ? m.screenAt : 0}>
        <AppBar right="Inbox" />
        <div className="px-5 pt-4">
          <h2 className="font-serif text-2xl font-bold">Inbox</h2>
          {s === 'inbox' ? (
            <div className="mt-3 rounded-lg border-2 border-accent bg-card p-3">
              <p className="text-[13px] font-semibold">About Sam, from Overlake ER</p>
              <p className="text-[12px] text-muted">just now</p>
              <div className="mt-2 aspect-square w-full overflow-hidden rounded-lg bg-ink">
                <DemoVideo src={unknownClip.video_path} className="h-full w-full object-cover" />
              </div>
              <div className="mt-3">
                <Field label="What does it mean?" value={answer} typing={isTyping('answer', momAnswer)} />
              </div>
              <div className="mt-3 flex gap-2">
                <span data-demo="mom-send" className="btn flex-1 py-2 text-[13px]">Send answer</span>
                <span className="btn-secondary px-2 py-1.5 text-[12px]">We don't recognise it</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-line bg-card p-3">
              <p className="text-[12px] text-muted">Sam · from Overlake ER · just now</p>
              <p className="mt-1 text-[14px]">
                <span className="font-semibold">You said: </span>
                {answer}
              </p>
              {saved ? (
                <p className="mt-2 text-[13px] font-semibold text-good" style={{ opacity: ease(t, m.savedAt!, 0.3) }}>
                  ✓ Saved to Sam's lexicon. The next nurse won't have to ask.
                </p>
              ) : (
                <span data-demo="mom-save-signal" className="btn-secondary mt-2 px-3 py-1.5 text-[13px]">
                  Save as a signal
                </span>
              )}
            </div>
          )}
        </div>
      </Screen>
    )
  }

  if (s === 'codes') {
    screen = (
      <Screen at={m.screenAt}>
        <AppBar right="Share codes" />
        <div className="px-5 pt-4">
          <h2 className="font-serif text-2xl font-bold">Share Sam's lexicon</h2>
          {!m.codeOff ? (
            <>
              <p className="mt-3 text-[14px] font-bold">Working codes</p>
              <div className="mt-2 rounded-lg border border-line bg-card p-3">
                <p className="font-semibold">Respite weekend</p>
                <p className="text-[13px] text-muted">Works until Sunday 6 PM</p>
                <div className="mt-2 flex gap-2">
                  <span className="btn-secondary px-3 py-1.5 text-[13px]">Copy link</span>
                  <span data-demo="mom-turn-off" className="btn-danger px-3 py-1.5 text-[13px]">Turn off</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[14px] font-bold">Working codes</p>
              <p className="text-[13px] text-muted">None right now.</p>
              <p className="mt-3 text-[14px] font-bold">Old codes</p>
              <div className="mt-2 flex justify-between rounded-lg border border-line bg-card p-3 text-[13px]">
                <span>Respite weekend</span>
                <span className="text-muted">Turned off just now</span>
              </div>
            </>
          )}
          <span data-demo="mom-who" className="btn-secondary mt-4 px-3 py-1.5 text-[13px]">Who looked</span>
        </div>
      </Screen>
    )
  }

  if (s === 'log') {
    const rows = [
      ['Turned off the code', 'just now'],
      ['Asked the family a question', '2:13 AM'],
      ['Confirmed a match: Rocks and hums, low', '2:11 AM'],
      ['Opened the lexicon', '2:10 AM'],
    ]
    screen = (
      <Screen at={m.screenAt}>
        <AppBar right="Who looked" />
        <div className="px-5 pt-4">
          <h2 className="font-serif text-2xl font-bold">Who looked</h2>
          <p className="text-[13px] text-muted">Everything that happened through a code.</p>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
            {rows.map(([what, when], i) => (
              <div key={what} className="p-3" style={{ opacity: ease(t, m.screenAt + 0.15 * i, 0.3) }}>
                <p className={'text-[14px] ' + (what.startsWith('Confirmed') ? 'font-semibold text-good' : '')}>{what}</p>
                <p className="text-[12px] text-muted">{when} · Respite weekend code</p>
              </div>
            ))}
          </div>
        </div>
      </Screen>
    )
  }

  return (
    <Phone
      label="Mom"
      sublabel="Sam's family · away this weekend"
      active={state.active !== 'nurse'}
      buzzAt={m.notifAt}
      overlay={overlay}
    >
      {screen}
    </Phone>
  )
}

export default MomPhone
