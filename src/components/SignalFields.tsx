import { bodyRegionNames, flaccNames, type BodyRegion, type FlaccCategory } from '../lib/types'

// everything the family fills in about a signal
export type SignalFieldValues = {
  title: string
  meaning: string
  action: string
  bodyRegion: BodyRegion
  hasSound: boolean
  flacc: FlaccCategory | ''
}

export const emptySignalFields: SignalFieldValues = {
  title: '',
  meaning: '',
  action: '',
  bodyRegion: 'whole_body',
  hasSound: false,
  flacc: '',
}

type Props = {
  value: SignalFieldValues
  onChange: (value: SignalFieldValues) => void
}

// the label form for a signal. used when recording a new one AND when
// saving a family's answer as a signal
function SignalFields({ value, onChange }: Props) {
  // change just one field
  function set(part: Partial<SignalFieldValues>) {
    onChange({ ...value, ...part })
  }

  return (
    <>
      <div>
        <label htmlFor="title" className="label">
          What does it look like?
        </label>
        <input
          id="title"
          required
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="e.g. Rocks forward and hums low"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="meaning" className="label">
          What does it mean?
        </label>
        <input
          id="meaning"
          required
          value={value.meaning}
          onChange={(e) => set({ meaning: e.target.value })}
          placeholder="e.g. Tummy pain"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="action" className="label">
          What should someone do? <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="action"
          value={value.action}
          onChange={(e) => set({ action: e.target.value })}
          placeholder="e.g. Check when they last ate, offer the heat pack"
          className="input"
        />
      </div>

      {/* this is what the "point" filter uses later */}
      <fieldset>
        <legend className="label">Where on the body?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(bodyRegionNames) as BodyRegion[]).map((region) => (
            <label
              key={region}
              className={
                'cursor-pointer rounded-md border px-3 py-2 ' +
                (value.bodyRegion === region ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-card')
              }
            >
              <input
                type="radio"
                name="region"
                value={region}
                checked={value.bodyRegion === region}
                onChange={() => set({ bodyRegion: region })}
                className="sr-only"
              />
              {bodyRegionNames[region]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* separate from body region because you can hum while rocking */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.hasSound}
          onChange={(e) => set({ hasSound: e.target.checked })}
          className="h-5 w-5"
        />
        It makes a sound
      </label>

      <div>
        <label htmlFor="flacc" className="label">
          Is it a pain sign? <span className="font-normal text-muted">(optional)</span>
        </label>
        <select
          id="flacc"
          value={value.flacc}
          onChange={(e) => set({ flacc: e.target.value as FlaccCategory | '' })}
          className="input"
        >
          <option value="">No / not sure</option>
          {(Object.keys(flaccNames) as FlaccCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              Yes: {flaccNames[cat]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted">
          These are the categories from the FLACC pain scale nurses already use.
        </p>
      </div>
    </>
  )
}

export default SignalFields
