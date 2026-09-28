import { Link, Navigate } from 'react-router-dom'
import SetupChecklist from '../components/SetupChecklist'
import { isFamily, useAuth } from '../lib/auth'
import { demoPersonId } from '../lib/demo'
import { isConfigured } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'

// the 4 layers, each one is there because the one before it can fail
const layers = [
  {
    name: 'Look',
    text: "Every clip plays at once, silently, on a loop. No words needed. Just watch until one matches what you're seeing.",
  },
  {
    name: 'Point',
    text: "Tap where it's happening: hands, face, legs, whole body, or “it's a sound.” Thirty clips become four.",
  },
  {
    name: 'Ask',
    text: "Still nothing? Film five seconds and send it. The family's phone buzzes, and their answer appears on your screen.",
  },
  {
    name: 'Honest no',
    text: "If nobody recognises it, Lexicon says so. A real answer is better than a guess that looks helpful.",
  },
]

function Home() {
  usePageTitle('')
  const { session, loading } = useAuth()

  // family members go straight to their people
  if (!loading && isFamily(session)) return <Navigate to="/people" replace />

  return (
    <div className="space-y-12">
      {/* the hook */}
      <section>
        <p className="font-semibold text-accent">For people who can't speak, and the strangers caring for them</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight font-bold">
          Their family understands every sound. The nurse at 2am doesn't.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Lexicon is a video dictionary of one person's signals, recorded by the people who know them
          best. A nurse, aide or sub scans a code and looks up what they're seeing in seconds. No
          account, no app to install.
        </p>

        {!isConfigured && (
          <div className="mt-6">
            <SetupChecklist />
          </div>
        )}

        {isConfigured && (
          <div className="mt-6 flex flex-wrap gap-3">
            {demoPersonId && (
              <Link to="/demo" className="btn">
                Try it as a nurse
              </Link>
            )}
            <Link to="/signin" className={demoPersonId ? 'btn-secondary' : 'btn'}>
              Family sign in
            </Link>
          </div>
        )}
      </section>

      {/* the story */}
      <section className="rounded-lg border border-line bg-card p-5">
        <h2 className="font-serif text-2xl font-bold">The moment it's for</h2>
        <p className="mt-3">
          Sam is 12 and doesn't speak. When his tummy hurts, he rocks and hums low. His mum has known
          that for years.
        </p>
        <p className="mt-2">
          Tonight Sam is in the ER, and his mum isn't there yet. The nurse sees him rocking and
          thinks he's anxious. She isn't confused, she's confidently wrong, so she'd never think to
          call anyone.
        </p>
        <p className="mt-2">
          With Lexicon, she scans the code on his bag and sees his mum's clip:{' '}
          <strong>"Rocks and hums low: pain, usually tummy."</strong>
        </p>
      </section>

      {/* how it works */}
      <section>
        <h2 className="font-serif text-2xl font-bold">How it works</h2>
        <p className="mt-2 text-muted">Four layers. Each one is there for when the one before it isn't enough.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {layers.map((layer, i) => (
            <li key={layer.name} className="rounded-lg border border-line bg-card p-4">
              <p className="text-sm font-semibold text-muted">Layer {i + 1}</p>
              <p className="text-lg font-bold">{layer.name}</p>
              <p className="mt-1">{layer.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* the one rule */}
      <section className="rounded-lg border-2 border-accent bg-card p-5">
        <h2 className="font-serif text-2xl font-bold">Lexicon never interprets. It only retrieves.</h2>
        <p className="mt-3">
          No AI decides what a movement means. On bodies that move differently, from a handful of
          examples, it would sometimes be wrong, and a wrong answer about pain is worse than no
          answer.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>The nurse can film what they see and play it side by side with the family's clip. They decide.</li>
          <li>Codes run out on their own, and the family can turn one off instantly.</li>
          <li>The family can see every time someone looked.</li>
          <li>Pain signs are tagged with the FLACC categories nurses already use.</li>
        </ul>
      </section>

      {/* for families */}
      <section>
        <h2 className="font-serif text-2xl font-bold">For families</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Record the sounds and movements only you understand, and say what each one means.</li>
          <li>Make a code for the ER, a new aide, or a respite worker. Set how long it lasts.</li>
          <li>When someone's stuck, answer from your phone. Save the answer so nobody has to ask again.</li>
        </ol>
        <p className="mt-3 text-muted">
          If you're in the room, they should just ask you. Lexicon is for all the hours you aren't.
        </p>
      </section>
    </div>
  )
}

export default Home
