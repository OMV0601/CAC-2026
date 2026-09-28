// makes the demo person "Sam" with 6 made-up signals.
// run: npm run seed:demo -- demo-email@whatever.com some-password
// (add --fresh at the end to delete the old demo and make a new one)
//
// it only uses the publishable key, same as the app. it signs in as a normal
// family account (making it if needed) and adds everything through the
// same rules everyone else has to follow

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readEnv } from './env.mjs'

const env = readEnv()
const [email, password] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const fresh = process.argv.includes('--fresh')

if (!email || !password) {
  console.log('Usage: npm run seed:demo -- demo-email@example.com a-password [--fresh]')
  process.exit(1)
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

function fail(what, error) {
  console.error('Failed to ' + what + ':', error.message ?? error)
  if (error.hint) console.error('Hint:', error.hint)
  process.exit(1)
}

// 1. sign in as the demo family (or make the account)
let { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) fail('make the demo account', error)
  if (!data.session) fail('sign in', { message: 'No session. Turn off "Confirm email" in Supabase first.' })
  console.log('Made demo account ' + email)
} else {
  console.log('Signed in as ' + email)
}

// 2. already have a demo person?
const { data: existing, error: existingError } = await supabase.from('people').select('id, name').eq('is_demo', true)
if (existingError) fail('look for the old demo (did you run 0009_demo.sql?)', existingError)

if (existing.length > 0 && !fresh) {
  console.log('\nDemo already exists. Put this in .env.local and Vercel:\n')
  console.log('VITE_DEMO_PERSON_ID=' + existing[0].id)
  console.log('\n(run again with --fresh to rebuild it)')
  process.exit(0)
}

// --fresh: delete the old demo (files first, while we're still in the circle)
for (const old of existing) {
  const { data: files } = await supabase.storage.from('signals').list(old.id, { limit: 1000 })
  const paths = (files ?? []).filter((f) => f.id).map((f) => old.id + '/' + f.name)
  if (paths.length > 0) await supabase.storage.from('signals').remove(paths)
  const { error } = await supabase.from('people').delete().eq('id', old.id)
  if (error) fail('delete the old demo', error)
  console.log('Deleted old demo ' + old.id)
}

// 3. make Sam
const { data: personId, error: personError } = await supabase.rpc('create_demo_person', {
  p_name: 'Sam',
  p_about: "Demo person, 12 years old, doesn't speak. Everything here is made up.",
})
if (personError) fail('make the demo person', personError)

// 4. upload each clip + poster and save the signal
const signals = JSON.parse(readFileSync('demo/signals.json', 'utf8'))
for (const s of signals) {
  const id = randomUUID()
  const videoPath = personId + '/' + id + '.webm'
  const posterPath = personId + '/' + id + '.jpg'

  const video = new Blob([readFileSync('demo/clips/' + s.clip + '.webm')], { type: 'video/webm' })
  const poster = new Blob([readFileSync('demo/clips/' + s.clip + '.jpg')], { type: 'image/jpeg' })

  let { error } = await supabase.storage.from('signals').upload(videoPath, video, { contentType: 'video/webm' })
  if (error) fail('upload ' + s.clip + '.webm', error)
  ;({ error } = await supabase.storage.from('signals').upload(posterPath, poster, { contentType: 'image/jpeg' }))
  if (error) fail('upload ' + s.clip + '.jpg', error)

  ;({ error } = await supabase.from('signals').insert({
    id,
    person_id: personId,
    title: s.title,
    meaning: s.meaning,
    action: s.action,
    body_region: s.body_region,
    has_sound: s.has_sound,
    flacc_category: s.flacc_category,
    video_path: videoPath,
    poster_path: posterPath,
    mime_type: 'video/webm',
    duration_ms: 4000,
  }))
  if (error) fail('save ' + s.title, error)
  console.log('  added: ' + s.title)
}

console.log('\nDone! Put this in .env.local AND Vercel, then restart / redeploy:\n')
console.log('VITE_DEMO_PERSON_ID=' + personId)
console.log('\nSign in as ' + email + " to see the demo family's inbox.")
