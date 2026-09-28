// makes the key pair for push notifications (VAPID keys)
// run it with: npm run vapid -- you@example.com
//
// the PUBLIC key gets printed (it's fine for anyone to see, it goes in the app).
// the PRIVATE key is written to .vapid.local and NEVER printed, because printed
// stuff ends up in terminal history, screenshots and screen recordings.

import { generateKeyPairSync } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'

const file = '.vapid.local'
if (existsSync(file)) {
  console.log(file + ' already exists. Delete it first if you really want new keys.')
  console.log('(new keys = everyone has to turn alerts on again)')
  process.exit(1)
}

const email = process.argv[2] || 'you@example.com'

// push uses the P-256 curve
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

// browsers want the public key as 0x04 + x + y, in base64url
const rawPublic = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(pub.x, 'base64url'),
  Buffer.from(pub.y, 'base64url'),
]).toString('base64url')

// same format as an env file, so supabase can read it straight in
writeFileSync(
  file,
  'VAPID_PUBLIC_KEY=' + rawPublic + '\n' +
    'VAPID_PRIVATE_KEY=' + priv.d + '\n' +
    'VAPID_SUBJECT=mailto:' + email + '\n',
)

console.log('Public key (put this in .env.local AND Vercel as VITE_VAPID_PUBLIC_KEY):')
console.log('')
console.log(rawPublic)
console.log('')
console.log('Private key saved to ' + file + ' (not shown on purpose).')
console.log('Next: npx supabase secrets set --env-file ' + file)
if (!process.argv[2]) console.log('Tip: pass your email, like: npm run vapid -- you@example.com')
