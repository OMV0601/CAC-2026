import type { SignalFieldValues } from '../components/SignalFields'
import { supabase } from './supabase'
import { baseType, fileExtension } from './video'

type SaveInput = {
  personId: string
  video: Blob
  mimeType: string
  durationMs: number | null
  poster: Blob | null
  fields: SignalFieldValues
  // set when this signal came from a family's answer to an ask
  sourceAskId?: string
}

// uploads the clip (and poster) and saves the signal row.
// if saving the row fails, the uploaded files get cleaned up again
export async function saveSignal(input: SaveInput): Promise<string> {
  if (!supabase) throw new Error('Supabase is not set up')

  const id = crypto.randomUUID()
  const videoPath = input.personId + '/' + id + '.' + fileExtension(input.mimeType)
  let posterPath: string | null = null
  const bucket = supabase.storage.from('signals')

  // 1. upload the video
  const { error: videoError } = await bucket.upload(videoPath, input.video, {
    contentType: baseType(input.mimeType),
  })
  if (videoError) throw videoError

  // 2. upload the poster (if it fails thats ok, the grid just has no poster)
  if (input.poster) {
    const path = input.personId + '/' + id + '.jpg'
    const { error: posterError } = await bucket.upload(path, input.poster, { contentType: 'image/jpeg' })
    if (!posterError) posterPath = path
  }

  // 3. save the row
  const f = input.fields
  const { error: insertError } = await supabase.from('signals').insert({
    id,
    person_id: input.personId,
    title: f.title.trim(),
    meaning: f.meaning.trim(),
    action: f.action.trim() || null,
    body_region: f.bodyRegion,
    has_sound: f.hasSound,
    flacc_category: f.flacc || null,
    video_path: videoPath,
    poster_path: posterPath,
    mime_type: input.mimeType,
    duration_ms: input.durationMs,
    source_ask_id: input.sourceAskId ?? null,
  })
  if (insertError) {
    // dont leave files lying around with no row pointing at them
    await bucket.remove(posterPath ? [videoPath, posterPath] : [videoPath])
    throw insertError
  }

  return id
}

// deletes a signal and its files
export async function deleteSignal(signal: { id: string; video_path: string; poster_path: string | null }) {
  if (!supabase) throw new Error('Supabase is not set up')
  // row first, so it disappears from the grid even if file cleanup fails
  const { error } = await supabase.from('signals').delete().eq('id', signal.id)
  if (error) throw error
  const files = signal.poster_path ? [signal.video_path, signal.poster_path] : [signal.video_path]
  await supabase.storage.from('signals').remove(files)
}
