import type { Signal } from '../lib/types'

// made up data for the guided demo. same shape as the real database rows,
// so the real SignalTile component can show them

function clip(name: string) {
  return { video_path: '/demo/' + name + '.webm', poster_path: '/demo/' + name + '.jpg' }
}

function signal(id: string, name: string, rest: Partial<Signal>): Signal {
  return {
    id,
    person_id: 'demo-sam',
    title: '',
    meaning: '',
    action: null,
    body_region: 'whole_body',
    has_sound: false,
    flacc_category: null,
    mime_type: 'video/webm',
    duration_ms: 4000,
    created_at: '',
    ...clip(name),
    ...rest,
  }
}

// the one mom records during the demo
export const rockSignal = signal('rock', 'rock', {
  title: 'Rocks and hums, low',
  meaning: 'Pain, usually his stomach',
  action: 'Heat pack on his tummy. Check when he last ate.',
  body_region: 'whole_body',
  has_sound: true,
  flacc_category: 'cry',
})

// the ones she already had
export const otherSignals: Signal[] = [
  signal('flap', 'flap', { title: 'Flaps both hands, smiling', meaning: 'Excited, happy', body_region: 'hands' }),
  signal('ears', 'ears', { title: 'Covers ears, eyes shut', meaning: 'Too loud or too bright', body_region: 'face' }),
  signal('chin', 'chin', { title: 'Taps his chin', meaning: 'Thirsty', body_region: 'hands' }),
  signal('kick', 'kick', { title: 'Leans back, kicks legs', meaning: 'Needs to be moved', body_region: 'whole_body' }),
  signal('eee', 'eee', { title: "Short high 'eee' sounds", meaning: 'Wants you to come back', body_region: 'face', has_sound: true }),
]

export const allSignals = [rockSignal, ...otherSignals]

// the thing mom never recorded (for the Ask part)
export const unknownClip = clip('rub')

export const momAnswer = "That's his tired sign. Dim the lights and he'll settle."

// scanning the QR code in the video opens the real demo
export const qrLink = 'https://cac-2026-8j6b.vercel.app/demo'
