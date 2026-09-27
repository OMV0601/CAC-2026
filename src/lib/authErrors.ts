import { getErrorMessage } from './errors'

// supabase sign in errors come back with a "code".
// these are the ones people actually run into, in plain english.
// anything we dont know about falls back to the real message
const friendly: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: "You haven't confirmed your email yet. Check your inbox for the link.",
  user_already_exists: 'That email already has an account. Sign in instead.',
  email_exists: 'That email already has an account. Sign in instead.',
  weak_password: 'That password is too easy to guess. Try a longer one.',
  email_address_invalid: "That doesn't look like a real email address.",
  signup_disabled: 'New accounts are turned off right now.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
  over_email_send_rate_limit:
    'Too many sign up emails were sent. Wait an hour and try again. (For the developer: turn off "Confirm email" in Supabase → Authentication → Sign In / Providers.)',
}

export function getAuthErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; name?: unknown; status?: unknown }

    if (typeof e.code === 'string' && friendly[e.code]) return friendly[e.code]

    // no internet / supabase down
    if (e.name === 'AuthRetryableFetchError' || e.status === 0) {
      return "Can't reach the server. Check your internet and try again."
    }
    // any other "too many requests"
    if (e.status === 429) return 'Too many tries. Wait a minute and try again.'
  }
  return getErrorMessage(err)
}
