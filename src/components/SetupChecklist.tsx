// shows up when the supabase env variables are missing,
// so you know exactly what to do instead of staring at a blank page

function SetupChecklist() {
  return (
    <section className="rounded-lg border border-warn bg-card p-5">
      <h2 className="text-lg font-bold text-warn">Lexicon isn't connected to Supabase yet</h2>
      <p className="mt-2 text-muted">Do these steps, then refresh:</p>

      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code>
        </li>
        <li>
          Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (Supabase →
          Project Settings → API Keys)
        </li>
        <li>
          Restart <code>npm run dev</code> (vite only reads env files when it starts)
        </li>
        <li>
          On Vercel: add the same two variables, mark them <strong>not</strong> sensitive, then{' '}
          <strong>Redeploy</strong>
        </li>
      </ol>
    </section>
  )
}

export default SetupChecklist
