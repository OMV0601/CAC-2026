import type { ReactNode } from 'react'
import { bodyRegionNames, flaccNames, type Signal } from '../lib/types'
import { DemoVideo, useDemoTime } from './clock'

// small building blocks the two demo phones share.
// they copy the look of the real Lexicon screens

// the mini header at the top of every Lexicon screen
export function AppBar({ right }: { right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line bg-card px-5 py-3">
      <span className="font-serif text-lg font-bold text-accent">Lexicon</span>
      <span className="text-xs text-muted">{right}</span>
    </div>
  )
}

// one clip in a grid
export function Tile({ signal, big, demo, glow }: { signal: Signal; big?: boolean; demo?: string; glow?: number }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-line bg-card"
      style={glow ? { boxShadow: `0 0 0 ${3 * glow}px rgba(10,95,91,${0.8 * glow})` } : undefined}
    >
      <div className="aspect-square bg-ink">
        <DemoVideo src={signal.video_path} poster={signal.poster_path ?? undefined} className="h-full w-full object-cover" />
      </div>
      <div className={big ? 'p-3' : 'p-2'}>
        <p className={'leading-tight font-semibold ' + (big ? 'text-base' : 'text-[12px]')}>{signal.title}</p>
        <p className={'mt-0.5 leading-tight ' + (big ? 'text-sm' : 'text-[11px]')}>
          <span className="text-muted">Means: </span>
          {signal.meaning}
        </p>
        {big && (
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            <span className="rounded border border-line px-1.5 text-muted">{bodyRegionNames[signal.body_region]}</span>
            {signal.has_sound && <span className="rounded border border-line px-1.5 text-muted">Sound</span>}
            {signal.flacc_category && (
              <span className="rounded border border-bad px-1.5 text-bad">Pain sign · {flaccNames[signal.flacc_category]}</span>
            )}
          </div>
        )}
        {demo && (
          <div data-demo={demo} className="btn-secondary mt-2 w-full py-1.5 text-[12px]">
            Looks like this? Compare
          </div>
        )}
      </div>
    </div>
  )
}

// a text box with typing in it
export function Field({ label, value, placeholder, typing }: { label: string; value: string; placeholder?: string; typing?: boolean }) {
  const { t } = useDemoTime()
  const caret = typing && Math.floor(t * 2.5) % 2 === 0
  return (
    <div>
      <p className="mb-1 text-[13px] font-semibold">{label}</p>
      <div className="min-h-[40px] rounded-md border border-line bg-card px-3 py-2 text-[14px]">
        {value ? value : <span className="text-muted">{placeholder}</span>}
        {caret && <span className="ml-px inline-block h-[16px] w-[2px] translate-y-[3px] bg-accent" />}
      </div>
    </div>
  )
}

// the dark camera box with the REC counter
export function Camera({ children, recAt, max, demo }: { children: ReactNode; recAt: number | null; max: number; demo: string }) {
  const { t } = useDemoTime()
  const recording = recAt != null && t >= recAt && t - recAt < max
  const secs = recAt != null ? Math.min(max, Math.floor(t - recAt)) : 0
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-ink">
        {children}
        {recording && (
          <span className="absolute top-3 left-3 rounded bg-bad px-2 py-0.5 text-[12px] font-bold text-white">
            ● REC {secs}s / {max}s
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-center">
        <div data-demo={demo} className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-4 border-ink/20 bg-card">
          <div className={recording ? 'h-6 w-6 rounded bg-bad' : 'h-12 w-12 rounded-full bg-bad'} />
        </div>
      </div>
    </div>
  )
}

// a "tap here" pill button
export function Pill({ on, children, demo }: { on?: boolean; children: ReactNode; demo?: string }) {
  return (
    <span
      data-demo={demo}
      className={
        'inline-block rounded-full border px-3 py-1.5 text-[13px] font-semibold ' +
        (on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-card text-ink')
      }
    >
      {children}
    </span>
  )
}
