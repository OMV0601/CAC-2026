// shapes of the rows we read from the database

export type Person = {
  id: string
  name: string
  about: string | null
  created_at: string
}

export type BodyRegion = 'hands' | 'face' | 'legs' | 'whole_body'

export type FlaccCategory = 'face' | 'legs' | 'activity' | 'cry' | 'consolability'

export type Signal = {
  id: string
  person_id: string
  title: string
  meaning: string
  action: string | null
  body_region: BodyRegion
  has_sound: boolean
  flacc_category: FlaccCategory | null
  video_path: string
  poster_path: string | null
  mime_type: string
  duration_ms: number | null
  created_at: string
}

// nice names to show on screen
export const bodyRegionNames: Record<BodyRegion, string> = {
  hands: 'Hands',
  face: 'Face',
  legs: 'Legs',
  whole_body: 'Whole body',
}

export const flaccNames: Record<FlaccCategory, string> = {
  face: 'Face',
  legs: 'Legs',
  activity: 'Activity',
  cry: 'Cry',
  consolability: 'Consolability',
}

// a QR code the family made for a stranger
export type Grant = {
  id: string
  person_id: string
  token: string
  label: string | null
  expires_at: string
  revoked_at: string | null
  created_at: string
}

// the link a stranger opens (the QR code just holds this)
export function codeLink(token: string) {
  return window.location.origin + '/c/' + token
}

// "Sat, Sep 26, 3:00 PM"
export function niceTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
