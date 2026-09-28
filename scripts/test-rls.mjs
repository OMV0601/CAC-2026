// security tests against the REAL database.
// run: npm run test:rls -- you+rlsa@gmail.com you+rlsb@gmail.com some-password
//
// it only uses the publishable key, which is already public inside the app's
// javascript. so this is exactly the power an attacker has.
// it makes 2 test family accounts (reused every run), a couple of anonymous
// "strangers", and some test data that gets deleted at the end.

import { createClient } from '@supabase/supabase-js'
import { readEnv } from './env.mjs'

const env = readEnv()
const [emailA, emailB, password] = process.argv.slice(2)
if (!emailA || !emailB || !password) {
  console.log('Usage: npm run test:rls -- test-a@email.com test-b@email.com a-password')
  console.log('(use two emails you own, like you+rlsa@gmail.com and you+rlsb@gmail.com)')
  process.exit(1)
}

function client() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

let passed = 0
let failed = 0
function check(name, ok, extra) {
  if (ok) {
    passed++
    console.log('  PASS  ' + name)
  } else {
    failed++
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))
  }
}
// "reading gave back nothing" (either an error or zero rows both count)
function empty(res) {
  return !!res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0)
}
function msg(res) {
  return res.error ? res.error.message : JSON.stringify(res.data)
}

async function signInOrUp(c, email) {
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (!error) return true
  const { data, error: upError } = await c.auth.signUp({ email, password })
  if (upError || !data.session) {
    console.log('Could not sign in or sign up ' + email + ': ' + (upError?.message ?? 'no session (turn off Confirm email)'))
    return false
  }
  return true
}

const tables = [
  'people', 'signals', 'circle_members', 'access_grants',
  'grant_sessions', 'ask_requests', 'push_subscriptions', 'access_log',
]
const tinyVideo = new Blob([new Uint8Array([26, 69, 223, 163, 0, 0, 0, 0])], { type: 'video/webm' })

// ------------------------------------------------------------
console.log('\n1. Nobody signed in (the "anon" role)')
const nobody = client()
for (const t of tables) {
  const res = await nobody.from(t).select('*').limit(1)
  check("can't read " + t, empty(res), msg(res))
}
check("can't call create_person", !!(await nobody.rpc('create_person', { p_name: 'x' })).error)
check("can't call claim_grant", !!(await nobody.rpc('claim_grant', { p_token: 'x' })).error)
const health = await nobody.rpc('lexicon_health')
check('lexicon_health works (and shows no data)', !health.error && Array.isArray(health.data?.tables), msg(health))

// ------------------------------------------------------------
console.log('\n2. Two families')
const famA = client()
const famB = client()
if (!(await signInOrUp(famA, emailA)) || !(await signInOrUp(famB, emailB))) process.exit(1)
check('family A signed in', true)
check('family B signed in', true)

const p = await famA.rpc('create_person', { p_name: 'RLS test person A', p_about: 'deleted after the test' })
const q = await famB.rpc('create_person', { p_name: 'RLS test person B', p_about: 'deleted after the test' })
check('A can add a person', !p.error, msg(p))
check('B can add a person', !q.error, msg(q))
const P = p.data
const Q = q.data

check('A can read their person', !empty(await famA.from('people').select('id').eq('id', P)))
check("A can't read B's person", empty(await famA.from('people').select('id').eq('id', Q)))
check("B can't read A's person", empty(await famB.from('people').select('id').eq('id', P)))

const clipPath = P + '/rls-test.webm'
const up = await famA.storage.from('signals').upload(clipPath, tinyVideo, { contentType: 'video/webm' })
check('A can upload a clip for their person', !up.error, msg(up))
const sig = await famA.from('signals').insert({
  person_id: P, title: 'test', meaning: 'test', video_path: clipPath, mime_type: 'video/webm',
})
check('A can add a signal', !sig.error, msg(sig))
check("B can't add a signal to A's person", !!(await famB.from('signals').insert({
  person_id: P, title: 'x', meaning: 'x', video_path: P + '/x.webm', mime_type: 'video/webm',
})).error)
check("B can't upload into A's person's folder", !!(await famB.storage.from('signals').upload(P + '/evil.webm', tinyVideo, { contentType: 'video/webm' })).error)
check("A can't write the access log directly", !!(await famA.from('access_log').insert({ person_id: P, action: 'fake' })).error)

const g1 = await famA.rpc('create_grant', { p_person: P, p_label: 'RLS test', p_minutes: 5 })
check('A can make a code', !g1.error, msg(g1))
const mins = (new Date(g1.data?.expires_at) - Date.now()) / 60000
check('a 5 minute code gets stretched to 15 minutes', mins > 14 && mins < 16, mins.toFixed(1) + ' min')
const g2 = await famA.rpc('create_grant', { p_person: P, p_label: 'RLS test long', p_minutes: 999999 })
const days = (new Date(g2.data?.expires_at) - Date.now()) / 86400000
check('a forever code gets cut down to 7 days', days > 6.9 && days < 7.1, days.toFixed(2) + ' days')
check("B can't make a code for A's person", !!(await famB.rpc('create_grant', { p_person: P, p_label: 'x', p_minutes: 60 })).error)
check("A can't sneak in a code by inserting directly", !!(await famA.from('access_grants').insert({
  person_id: P, expires_at: '2099-01-01', created_by: (await famA.auth.getUser()).data.user.id,
})).error)
const token = g1.data?.token

// ------------------------------------------------------------
console.log('\n3. A stranger with a code')
const s1 = client()
const anonRes = await s1.auth.signInAnonymously()
check('stranger can sign in anonymously', !anonRes.error, anonRes.error?.message + ' (turn on anonymous sign-ins)')
check('before scanning, sees nobody', empty(await s1.from('people').select('id')))
const bad = await s1.rpc('claim_grant', { p_token: 'not-a-real-code' })
check('a made up code is refused', bad.data?.ok === false, msg(bad))
const good = await s1.rpc('claim_grant', { p_token: token })
check('the real code works', good.data?.ok === true, msg(good))
check("can see A's person's signals", !empty(await s1.from('signals').select('id').eq('person_id', P)))
check("can't see B's person", empty(await s1.from('people').select('id').eq('id', Q)))
check("can't read the codes table", empty(await s1.from('access_grants').select('id')))
check("can't read the circle", empty(await s1.from('circle_members').select('user_id')))
check("can't add a person", !!(await s1.rpc('create_person', { p_name: 'x' })).error)
check("can't make codes", !!(await s1.rpc('create_grant', { p_person: P, p_label: 'x', p_minutes: 60 })).error)
check("can't add signals", !!(await s1.from('signals').insert({
  person_id: P, title: 'x', meaning: 'x', video_path: P + '/x.webm', mime_type: 'video/webm',
})).error)
check("can't turn on family alerts", !!(await s1.rpc('save_push_subscription', {
  p_endpoint: 'https://push.example/x', p_p256dh: 'x', p_auth: 'x',
})).error)
check('can play the family clip', !(await s1.storage.from('signals').createSignedUrl(clipPath, 60)).error)

const askPath = P + '/asks/rls-test-' + Date.now() + '.webm'
check('can upload into the asks folder', !(await s1.storage.from('signals').upload(askPath, tinyVideo, { contentType: 'video/webm' })).error)
check("can't upload anywhere else", !!(await s1.storage.from('signals').upload(P + '/sneaky.webm', tinyVideo, { contentType: 'video/webm' })).error)
check("can't upload a non-video file", !!(await s1.storage.from('signals').upload(P + '/asks/x.html', new Blob(['<script>'], { type: 'text/html' }), { contentType: 'text/html' })).error)
const ask = await s1.rpc('create_ask', { p_person: P, p_video_path: askPath, p_mime: 'video/webm', p_note: 'rls test' })
check('can ask the family', !ask.error, msg(ask))
check("can't point an ask at the family's clip", !!(await s1.rpc('create_ask', { p_person: P, p_video_path: clipPath, p_mime: 'video/webm', p_note: null })).error)
check("can't answer their own ask", !!(await s1.rpc('answer_ask', { p_ask: ask.data, p_answer: 'x', p_known: true })).error)

const s2 = client()
await s2.auth.signInAnonymously()
await s2.rpc('claim_grant', { p_token: token })
check("a 2nd stranger can't see the 1st one's question", empty(await s2.from('ask_requests').select('id')))
check("a 2nd stranger can't watch the 1st one's video", !!(await s2.storage.from('signals').createSignedUrl(askPath, 60)).error)

const answer = await famA.rpc('answer_ask', { p_ask: ask.data, p_answer: 'rls test answer', p_known: true })
check('family can answer', !answer.error, msg(answer))
const seen = await s1.from('ask_requests').select('status, answer').eq('id', ask.data).maybeSingle()
check('the stranger sees the answer', seen.data?.answer === 'rls test answer', msg(seen))

// ------------------------------------------------------------
console.log('\n4. Turning the code off')
check('A can turn the code off', !(await famA.rpc('revoke_grant', { p_grant: g1.data.id })).error)
check('stranger instantly sees nothing', empty(await s1.from('signals').select('id').eq('person_id', P)))
const again = await s1.rpc('claim_grant', { p_token: token })
check('scanning again says it was turned off', again.data?.reason === 'revoked', msg(again))
check("stranger can't get new video links", !!(await s1.storage.from('signals').createSignedUrl(clipPath, 60)).error)
check("stranger can't ask anymore", !!(await s1.rpc('create_ask', { p_person: P, p_video_path: askPath, p_mime: 'video/webm', p_note: null })).error)

// ------------------------------------------------------------
console.log('\nCleaning up test data...')
const { data: files } = await famA.storage.from('signals').list(P, { limit: 100 })
const { data: askFiles } = await famA.storage.from('signals').list(P + '/asks', { limit: 100 })
const paths = [
  ...(files ?? []).filter((f) => f.id).map((f) => P + '/' + f.name),
  ...(askFiles ?? []).filter((f) => f.id).map((f) => P + '/asks/' + f.name),
]
if (paths.length) await famA.storage.from('signals').remove(paths)
await famA.from('people').delete().eq('id', P)
await famB.from('people').delete().eq('id', Q)
console.log('(expired codes are covered by the local SQL tests, since codes last at least 15 minutes)')

console.log('\n' + passed + ' passed, ' + failed + ' failed')
process.exit(failed > 0 ? 1 : 0)
