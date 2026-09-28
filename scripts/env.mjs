// tiny helper: reads VITE_ values out of .env.local for our node scripts
import { existsSync, readFileSync } from 'node:fs'

export function readEnv() {
  const env = { ...process.env }
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
  }
  return env
}
