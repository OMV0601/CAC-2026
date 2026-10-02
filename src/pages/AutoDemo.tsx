import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { DemoTime, ease, waitForVideos } from '../autodemo/clock'
import Cursor from '../autodemo/Cursor'
import MomPhone from '../autodemo/MomPhone'
import NursePhone from '../autodemo/NursePhone'
import { buildScript, phases, stateAt } from '../autodemo/script'
import { usePageTitle } from '../lib/usePageTitle'

// the guided "auto demo": both phones side by side, playing the whole story
// by itself. it uses made up data, but the screens copy the real app.
//
// /autodemo              plays in the browser
// /autodemo?capture=1    frame by frame mode, for recording the video
// /autodemo?d=19,23,21,12   how long each step lasts (to match the voiceover)

const params = new URLSearchParams(window.location.search)
const capture = params.get('capture') === '1'
const durations = (params.get('d') ?? '').split(',').map(Number).filter((n) => n > 0)

declare global {
  interface Window {
    __demo?: { total: number; setTime: (t: number) => Promise<void> }
  }
}

function AutoDemo() {
  usePageTitle('Auto demo')
  const script = useMemo(() => buildScript(durations), [])
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(!capture)
  const [scale, setScale] = useState(1)
  const stageRef = useRef<HTMLDivElement>(null)

  // fit the 1920x1080 stage inside the window
  useEffect(() => {
    if (capture) return
    function fit() {
      setScale(Math.min(window.innerWidth / 1920, (window.innerHeight - 64) / 1080))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // live mode: the clock just runs
  useEffect(() => {
    if (capture || !playing) return
    let frame = 0
    let last = performance.now()
    function tick(now: number) {
      const dt = (now - last) / 1000
      last = now
      setT((old) => {
        const next = old + dt
        if (next >= script.total) {
          setPlaying(false)
          return script.total
        }
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, script.total])

  // capture mode: the recording script calls window.__demo.setTime(t)
  useEffect(() => {
    if (!capture) return
    window.__demo = {
      total: script.total,
      setTime: async (time: number) => {
        flushSync(() => setT(time))
        await waitForVideos()
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      },
    }
  }, [script.total])

  const state = stateAt(script, t)
  const phase = phases[state.phase]
  const titleIn = ease(t, script.starts[state.phase], 0.5)
  // how much this step got stretched to fit the voice
  const phaseStart = script.starts[state.phase]
  const phaseEnd = script.starts[state.phase + 1] ?? script.total
  const stretch = (phaseEnd - phaseStart) / phase.nominal

  function restart() {
    setT(0)
    setPlaying(true)
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#e9e4dc]">
      <div
        ref={stageRef}
        className="relative origin-top-left overflow-hidden"
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          marginLeft: capture ? 0 : (window.innerWidth - 1920 * scale) / 2,
          background: 'radial-gradient(1200px 700px at 72% 45%, #ffffff 0%, #fbf8f3 45%, #efe9df 100%)',
        }}
      >
        <DemoTime.Provider value={{ t, capture }}>
          {/* top bar */}
          <div className="absolute top-10 left-20 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-serif text-2xl font-bold text-white">L</span>
            <span className="font-serif text-3xl font-bold text-accent">Lexicon</span>
          </div>
          <div className="absolute top-[50px] left-[300px] rounded-full border border-line bg-card px-4 py-1.5 text-base text-muted">
            Guided demo · made-up family · real Lexicon screens
          </div>

          {/* left side: which step we're on */}
          <div className="absolute top-[300px] left-20 w-[560px]" style={{ opacity: titleIn, transform: `translateY(${(1 - titleIn) * 16}px)` }}>
            <div className="flex gap-2">
              {phases.map((p, i) => (
                <span key={p.title} className={'h-2 w-14 rounded-full ' + (i <= state.phase ? 'bg-accent' : 'bg-line/50')} />
              ))}
            </div>
            <p className="mt-6 text-2xl font-semibold text-accent">Step {state.phase + 1} of 4</p>
            <h1 className="mt-2 font-serif text-6xl leading-tight font-bold text-ink">{phase.title}</h1>
            <ul className="mt-8 space-y-4">
              {phase.points.map((point) => {
                const k = ease(t, phaseStart + point.at * stretch, 0.4)
                return (
                  <li
                    key={point.text}
                    className="flex items-center gap-4 text-3xl font-semibold text-ink"
                    style={{ opacity: k, transform: `translateX(${(1 - k) * -18}px)` }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xl text-white">✓</span>
                    {point.text}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* the two phones */}
          <div className="absolute top-[70px] left-[760px] flex gap-[90px]">
            <MomPhone state={state} script={script} />
            <NursePhone state={state} />
          </div>

          <Cursor script={script} stageRef={stageRef} />
        </DemoTime.Provider>
      </div>

      {/* controls (not in the recording) */}
      {!capture && (
        <div className="fixed inset-x-0 bottom-0 flex h-16 items-center gap-4 border-t border-line bg-card px-6">
          <button type="button" onClick={() => (t >= script.total ? restart() : setPlaying(!playing))} className="btn px-5 py-2">
            {t >= script.total ? 'Play again' : playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={restart} className="btn-secondary px-4 py-1.5">
            Restart
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/40" role="progressbar" aria-label="Demo progress" aria-valuenow={Math.round((t / script.total) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent" style={{ width: `${(t / script.total) * 100}%` }} />
          </div>
          <Link to="/" className="text-muted underline">
            Back to Lexicon
          </Link>
        </div>
      )}
    </div>
  )
}

export default AutoDemo
