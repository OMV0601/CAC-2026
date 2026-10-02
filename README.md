# Lexicon

A video dictionary for people who can't speak. Families record the sounds and
movements only they understand, and a nurse or aide who has never met the
person scans a code and looks them up. No account needed.

**Lexicon never interprets. It only retrieves.** No AI guesses what a signal
means. A person always decides.

## How it works

1. **Look**: every clip plays at once, muted and looping
2. **Point**: tap where it's happening (hands / face / legs / whole body / sound)
3. **Ask**: film 5 seconds, the family's phone buzzes, the answer shows up live
4. **Honest no**: if nobody recognises it, Lexicon says so instead of guessing

Plus side-by-side confirming, codes that expire, instant revoke, and a log of
everyone who looked.

## Stack

- Vite + React 19 + TypeScript + Tailwind v4
- Supabase (database, auth, storage, realtime, edge function)
- Vercel (hosting)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key
3. In Supabase:
   - **Storage → New bucket** → name it `signals` → **Public OFF**
   - **SQL Editor** → run each file in `supabase/migrations/` in order
     (0001 through 0009)
   - **Authentication → Sign In / Providers → Email** → turn off "Confirm email"
   - Same page → turn ON **anonymous sign-ins** (strangers with a code need it)
4. `npm run dev`
5. Open `/debug` and make sure nothing is red

## Demo

`npm run seed:demo -- demo@your-email.com a-password`

Makes a made-up person, "Sam", with 6 signals. The clips in `demo/clips` are
drawn illustrations and are labelled as demos. Put the printed
`VITE_DEMO_PERSON_ID` in `.env.local` (and Vercel) and the home page gets a
"Try it as a nurse" button. Each click makes a fresh 2 hour code, so the demo
never expires.

## Auto demo and slides

- `/autodemo` plays the whole story by itself on two phones side by side
  (made-up family, same screens as the real app). There's a button for it on
  the home page.
- `/presentation/index.html` has the slides from our demo video
  (arrow keys to move).
- `video/` has the video script and the script that records and edits the
  video (`video/build-video.mjs`). Voice files can be mp3, m4a or mp4, named
  like `05-om.mp3`. Our photos for the "who we are" slide are in
  `public/presentation/team/`.

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

## Checks

- `npm run test:rls -- a@email.com b@email.com password` - security tests
  against the real database, using only the public key (the same power an
  attacker has). Needs two emails you own.
- `npm run audit:ui` - accessibility, measured with axe-core. Run
  `npm run build && npm run preview` first, or pass your site's URL. Add an
  email and password to check the family pages too. First time only:
  `npx playwright install chromium`
- `npm run contrast` - checks every color pair passes WCAG AA

## Deploying on Vercel

1. Import the repo. Preset: Vite. `vercel.json` already handles page routes and
   the service worker.
2. Add these environment variables (mark them **not** sensitive):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY`
   - `VITE_DEMO_PERSON_ID`
3. **Redeploy.** Vite bakes env variables in at build time.
4. In Supabase → **Authentication → URL Configuration**: set Site URL to your
   Vercel URL and add `https://<your-domain>/**` to Redirect URLs.

Then open `/debug` on the live site, and test on two real devices, including
the phone buzzing with the browser closed.

Never put the `service_role` / secret key anywhere in this repo.
