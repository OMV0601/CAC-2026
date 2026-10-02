// the guided demo is one long "script" of events on a timeline.
// everything on screen is worked out from the current time t, so the demo
// always looks exactly the same (we need that to record the video frame by frame)

import { momAnswer } from './data'

export type MomScreen =
  | 'home'
  | 'camera'
  | 'label'
  | 'home-new'
  | 'code-form'
  | 'code-made'
  | 'inbox'
  | 'answered'
  | 'codes'
  | 'log'

export type NurseScreen =
  | 'idle'
  | 'scanner'
  | 'grid'
  | 'compare-camera'
  | 'side-by-side'
  | 'matched'
  | 'ask-intro'
  | 'ask-camera'
  | 'ask-review'
  | 'waiting'
  | 'answered'
  | 'honest-no'
  | 'revoked'

export type DemoState = {
  phase: number
  active: 'mom' | 'nurse' | 'both'
  mom: {
    screen: MomScreen
    screenAt: number
    recAt: number | null // when the camera started recording
    region: boolean
    sound: boolean
    pain: boolean
    threeDays: boolean
    notifAt: number | null // when the notification came in (null = none)
    savedAt: number | null
    codeOff: boolean
  }
  nurse: {
    screen: NurseScreen
    screenAt: number
    scanned: boolean
    region: 'all' | 'whole_body'
    sound: boolean
    recAt: number | null
    answeredAt: number | null
  }
}

type Tap = { at: number; target: string }
type Typing = { at: number; field: string; text: string; dur: number }
type Change = { at: number; apply: (s: DemoState, at: number) => void }

// titles for the left side of the screen. the points pop in one by one
// (at = seconds into the step, for the normal length of the step)
export const phases = [
  {
    title: 'The family records',
    nominal: 19,
    points: [
      { at: 1.0, text: 'Film the signal' },
      { at: 6.0, text: 'Say what it means' },
      { at: 9.8, text: 'Tag where + how' },
      { at: 13.2, text: 'Share a code that expires' },
    ],
  },
  {
    title: 'The nurse looks it up',
    nominal: 23,
    points: [
      { at: 0.4, text: 'Scan. No account.' },
      { at: 2.6, text: 'Watch every clip' },
      { at: 5.6, text: 'Tap where + sound' },
      { at: 10.0, text: 'Compare side by side' },
    ],
  },
  {
    title: 'Ask the family',
    nominal: 21,
    points: [
      { at: 1.2, text: 'Film 5 seconds' },
      { at: 8.6, text: "Mom's phone buzzes" },
      { at: 14.6, text: 'Answer shows up live' },
      { at: 17.2, text: 'Saved for the next nurse' },
    ],
  },
  {
    title: 'Built on trust',
    nominal: 12,
    points: [
      { at: 0.3, text: 'Honest "no match"' },
      { at: 4.2, text: 'Off switch, instantly' },
      { at: 7.4, text: 'Log of who looked' },
    ],
  },
]

export type Script = {
  total: number
  starts: number[]
  taps: Tap[]
  typing: Typing[]
  changes: Change[]
}

// builds the timeline. durations = how long each phase lasts (seconds).
// the event times below are written for the "nominal" length and get
// stretched to fit, so the demo can line up with the voiceover
export function buildScript(durations: number[]): Script {
  const taps: Tap[] = []
  const typing: Typing[] = []
  const changes: Change[] = []
  const starts: number[] = []

  let base = 0
  let scale = 1
  const T = (x: number) => base + x * scale

  function tap(x: number, target: string) {
    taps.push({ at: T(x), target })
  }
  function type(x: number, field: string, text: string, dur: number) {
    typing.push({ at: T(x), field, text, dur: dur * scale })
  }
  function at(x: number, apply: (s: DemoState, at: number) => void) {
    changes.push({ at: T(x), apply })
  }
  function mom(x: number, screen: MomScreen) {
    at(x, (s, when) => {
      s.mom.screen = screen
      s.mom.screenAt = when
    })
  }
  function nurse(x: number, screen: NurseScreen) {
    at(x, (s, when) => {
      s.nurse.screen = screen
      s.nurse.screenAt = when
    })
  }

  const phaseFns = [
    // 1. the family records
    () => {
      at(0, (s) => (s.active = 'mom'))
      mom(0, 'home')
      tap(1.0, 'mom-record')
      mom(1.35, 'camera')
      tap(2.2, 'mom-rec')
      at(2.35, (s, when) => (s.mom.recAt = when))
      tap(5.4, 'mom-rec')
      mom(5.6, 'label')
      type(6.0, 'title', 'Rocks and hums, low', 1.6)
      type(7.9, 'meaning', 'Pain, usually his stomach', 1.6)
      tap(9.8, 'mom-region')
      at(9.8, (s) => (s.mom.region = true))
      tap(10.4, 'mom-sound')
      at(10.4, (s) => (s.mom.sound = true))
      tap(11.0, 'mom-pain')
      at(11.0, (s) => (s.mom.pain = true))
      tap(11.8, 'mom-save')
      mom(12.1, 'home-new')
      tap(13.2, 'mom-share')
      mom(13.5, 'code-form')
      type(13.9, 'codeLabel', 'Respite weekend', 1.2)
      tap(15.3, 'mom-3d')
      at(15.3, (s) => (s.mom.threeDays = true))
      tap(15.9, 'mom-make')
      mom(16.2, 'code-made')
    },
    // 2. the nurse looks it up
    () => {
      at(0, (s) => (s.active = 'nurse'))
      nurse(0, 'scanner')
      at(1.6, (s) => (s.nurse.scanned = true))
      tap(2.2, 'nurse-open')
      nurse(2.5, 'grid')
      tap(5.6, 'chip-whole_body')
      at(5.6, (s) => (s.nurse.region = 'whole_body'))
      tap(7.6, 'chip-sound')
      at(7.6, (s) => (s.nurse.sound = true))
      tap(10.0, 'nurse-compare')
      nurse(10.3, 'compare-camera')
      tap(10.9, 'nurse-rec')
      at(11.0, (s, when) => (s.nurse.recAt = when))
      nurse(14.0, 'side-by-side')
      tap(16.8, 'nurse-yes')
      nurse(17.1, 'matched')
    },
    // 3. ask the family
    () => {
      at(0, (s) => {
        s.active = 'both'
        s.nurse.region = 'all'
        s.nurse.sound = false
        s.nurse.recAt = null
      })
      nurse(0, 'ask-intro')
      tap(1.2, 'nurse-ask')
      nurse(1.5, 'ask-camera')
      tap(2.0, 'nurse-rec')
      at(2.1, (s, when) => (s.nurse.recAt = when))
      nurse(7.1, 'ask-review')
      tap(7.6, 'nurse-send')
      nurse(7.9, 'waiting')
      at(8.6, (s, when) => (s.mom.notifAt = when))
      tap(10.0, 'mom-notif')
      mom(10.3, 'inbox')
      at(10.3, (s) => (s.mom.notifAt = null))
      type(10.9, 'answer', momAnswer, 3.0)
      tap(14.3, 'mom-send')
      mom(14.6, 'answered')
      nurse(14.6, 'answered')
      at(14.6, (s, when) => (s.nurse.answeredAt = when))
      tap(17.2, 'mom-save-signal')
      at(17.5, (s, when) => (s.mom.savedAt = when))
    },
    // 4. trust
    () => {
      at(0, (s) => (s.active = 'nurse'))
      nurse(0, 'honest-no')
      at(3.2, (s) => (s.active = 'mom'))
      mom(3.2, 'codes')
      tap(4.2, 'mom-turn-off')
      at(4.5, (s) => {
        s.mom.codeOff = true
        s.active = 'both'
      })
      nurse(4.5, 'revoked')
      tap(7.4, 'mom-who')
      mom(7.7, 'log')
    },
  ]

  phaseFns.forEach((fn, i) => {
    const length = durations[i] ?? phases[i].nominal
    starts.push(base)
    scale = length / phases[i].nominal
    const phaseIndex = i
    at(0, (s) => (s.phase = phaseIndex))
    fn()
    base += length
  })

  changes.sort((a, b) => a.at - b.at)
  return { total: base, starts, taps, typing, changes }
}

function startState(): DemoState {
  return {
    phase: 0,
    active: 'mom',
    mom: {
      screen: 'home',
      screenAt: 0,
      recAt: null,
      region: false,
      sound: false,
      pain: false,
      threeDays: false,
      notifAt: null,
      savedAt: null,
      codeOff: false,
    },
    nurse: {
      screen: 'idle',
      screenAt: 0,
      scanned: false,
      region: 'all',
      sound: false,
      recAt: null,
      answeredAt: null,
    },
  }
}

// what everything looks like at time t
export function stateAt(script: Script, t: number): DemoState {
  const s = startState()
  for (const change of script.changes) {
    if (change.at > t) break
    change.apply(s, change.at)
  }
  return s
}

// how much of a typed field is showing at time t
export function typedAt(script: Script, field: string, t: number): string {
  let text = ''
  for (const ty of script.typing) {
    if (ty.field !== field || ty.at > t) continue
    const shown = Math.min(ty.text.length, Math.floor(((t - ty.at) / ty.dur) * ty.text.length))
    text = ty.text.slice(0, shown)
  }
  return text
}
