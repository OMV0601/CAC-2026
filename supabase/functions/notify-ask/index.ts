// notify-ask: buzzes the family's phones when a stranger asks a question.
// runs on supabase (deno), NOT in the browser.
//
// deploy:  npx supabase functions deploy notify-ask
// secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
//  given to every edge function automatically)

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // browsers ask "am i allowed?" before the real request
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

  if (!vapidPublic || !vapidPrivate) {
    // never print the key itself, just say it's missing
    console.error('notify-ask: VAPID keys are not set')
    return json({ error: 'not_configured' }, 500)
  }

  // 1. who is calling? (the stranger's anonymous login)
  const authHeader = req.headers.get('Authorization') ?? ''
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await asCaller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'not_signed_in' }, 401)
  const callerId = userData.user.id

  let askId = ''
  try {
    const body = await req.json()
    askId = typeof body.ask_id === 'string' ? body.ask_id : ''
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!askId) return json({ error: 'bad_request' }, 400)

  // 2. from here we use the service key, which skips RLS,
  //    so we have to check everything ourselves
  const admin = createClient(url, serviceKey)

  const { data: target } = await admin
    .from('ask_requests')
    .select('id, person_id, asker_user_id, notified_at, people(name)')
    .eq('id', askId)
    .maybeSingle()

  // only the person who asked can trigger the buzz.
  // say "unknown_ask" (not "forbidden") so nobody learns if the ask exists
  if (!target || target.asker_user_id !== callerId) {
    return json({ error: 'unknown_ask' }, 404)
  }

  // only buzz once per ask. this also stops someone spamming the family
  const { data: claimed } = await admin
    .from('ask_requests')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', askId)
    .is('notified_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return json({ sent: 0, already: true })

  // 3. who should get it? everyone in the circle who can answer
  const { data: members } = await admin
    .from('circle_members')
    .select('user_id')
    .eq('person_id', target.person_id)
    .eq('can_answer', true)
  const userIds = (members ?? []).map((m) => m.user_id)
  if (userIds.length === 0) return json({ sent: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  // 4. send it
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
  const personName = (target.people as { name?: string } | null)?.name ?? 'your person'
  const payload = JSON.stringify({
    title: 'Someone needs help reading ' + personName,
    body: 'A nurse or aide sent a clip. Tap to answer.',
    url: '/inbox',
  })

  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 },
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404 / 410 = that browser unsubscribed or is gone. clean it up
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        // the error message is safe to log, it never has the private key in it
        console.error('notify-ask: push failed', status ?? (err as Error).message)
      }
    }
  }

  return json({ sent })
})
