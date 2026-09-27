import { supabase } from './supabase'
import type { Signal } from './types'

// loads every clip for a person, plus temporary links to play them.
// used by the family page AND the stranger page (RLS decides who can see what)
export async function loadLexicon(personId: string, linkSeconds: number) {
  if (!supabase) throw new Error('Supabase is not set up')

  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const signals = (data ?? []) as Signal[]

  // the bucket is private, so ask for links that only work for a little while
  const paths: string[] = []
  for (const s of signals) {
    paths.push(s.video_path)
    if (s.poster_path) paths.push(s.poster_path)
  }

  // storage path -> link we can actually play
  const urls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from('signals')
      .createSignedUrls(paths, linkSeconds)
    if (signError) throw signError
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
    }
  }

  return { signals, urls }
}
