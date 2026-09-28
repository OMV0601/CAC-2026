import { supabase } from './supabase'

// phone alerts for the family (web push)

export const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

// can this browser even do push?
// (on iphone it only works after "Add to Home Screen")
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// the push api wants the key as bytes, not text
function keyToBytes(base64url: string) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

// is this browser already signed up for alerts?
export async function isPushOn(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return sub !== null && Notification.permission === 'granted'
}

export async function turnOnPush() {
  if (!supabase) throw new Error('Supabase is not set up')
  if (!pushSupported()) {
    throw new Error("This browser can't do alerts. On iPhone, add Lexicon to your Home Screen first.")
  }
  if (!vapidPublicKey) throw new Error('VITE_VAPID_PUBLIC_KEY is missing. Run npm run vapid.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Alerts were blocked. Allow notifications for this site in your browser settings.')
  }

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  // reuse the old subscription if there is one
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(vapidPublicKey),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  })
  if (error) throw error
}

export async function turnOffPush() {
  if (!supabase || !pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  // RLS only lets us delete our own row
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

// called after a stranger asks. push is a bonus, not the main path:
// realtime already delivers the question, so if this fails we just move on
export async function notifyFamily(askId: string) {
  if (!supabase) return
  try {
    await supabase.functions.invoke('notify-ask', { body: { ask_id: askId } })
  } catch {
    // ignore, see above
  }
}
