/// <reference types="vite/client" />

// tells typescript which env variables we have
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_DEMO_PERSON_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
