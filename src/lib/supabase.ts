import { createClient } from '@supabase/supabase-js'

// these come from .env.local (or Vercel env vars)
// vite puts them into the code at BUILD time, so after changing them
// on Vercel you have to redeploy
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// true when both env vars are filled in
export const isConfigured = supabaseUrl !== '' && supabaseKey !== ''

// if the env vars are missing we dont make a client at all,
// the app shows the setup checklist instead of crashing
export const supabase = isConfigured ? createClient(supabaseUrl, supabaseKey) : null
