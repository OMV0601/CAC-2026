# Lexicon

A video dictionary for people who can't speak. Families record the sounds and
movements only they understand, and a nurse or aide who has never met the
person scans a code and looks them up.

Lexicon never interprets. It only retrieves.

## Stack

- Vite + React 19 + TypeScript + Tailwind v4
- Supabase (database, auth, storage)
- Vercel (hosting)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key
3. In Supabase:
   - **Storage → New bucket** → name it `signals` → **Public OFF**
   - **SQL Editor** → run each file in `supabase/migrations/` in order
     (0001 through 0008)
   - **Authentication → Sign In / Providers → Email** → turn off "Confirm email"
     (or leave it on and click the link in the email after signing up)
   - Same page → turn ON **anonymous sign-ins** (strangers with a code need it)
4. `npm run dev`
5. Open `/debug` and make sure every row is green

Testing the camera on a phone needs https, so use the Vercel link for that
(localhost works on the laptop itself).

## Phone alerts (web push)

1. `npm run vapid -- you@example.com`
   - prints the PUBLIC key -> put it in `.env.local` as `VITE_VAPID_PUBLIC_KEY`
     (and in Vercel)
   - saves the PRIVATE key to `.vapid.local` (never printed, never committed)
2. `npx supabase login`
3. `npx supabase link --project-ref <your project id>`
4. `npx supabase secrets set --env-file .vapid.local`
5. `npx supabase functions deploy notify-ask`

Push is a bonus. If it's not set up, asks still reach the family's inbox live.
On iPhone, alerts only work after "Add to Home Screen".

## Scripts

- `npm run dev` - run locally
- `npm run build` - build for production
- `npm run contrast` - check our colors pass WCAG contrast
- `npm run vapid` - make the keys for phone alerts

## Deploying on Vercel

Import the repo (preset: Vite), add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY` as env variables (NOT sensitive), then redeploy.
Vite bakes env variables in at build time, so any change needs a redeploy.

Never put the `service_role` / secret key anywhere in this repo.
