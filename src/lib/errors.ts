// turns ANY thrown thing into a message a human can read.
// we learned the hard way: dont just check "instanceof Error",
// supabase errors are plain objects and would get hidden behind
// some useless "something went wrong" message

export function getErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return 'Unknown error'
  if (typeof err === 'string') return err

  if (typeof err === 'object') {
    const e = err as { message?: unknown; hint?: unknown; details?: unknown; code?: unknown }
    const parts: string[] = []

    if (typeof e.message === 'string' && e.message) parts.push(e.message)
    // postgres puts the actual fix in "hint" a lot of the time, so show it
    if (typeof e.hint === 'string' && e.hint) parts.push('Hint: ' + e.hint)
    if (typeof e.details === 'string' && e.details) parts.push(e.details)
    if (typeof e.code === 'string' && e.code) parts.push('(code ' + e.code + ')')

    if (parts.length > 0) return parts.join(' ')
  }

  // last try, just turn it into text
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
