import { bodyRegionNames, flaccNames, type Signal } from '../lib/types'

type Props = {
  signal: Signal
  videoUrl: string | null
  posterUrl: string | null
}

// one clip in the grid.
// the video needs ALL FOUR of these or it breaks somewhere:
//   muted       - browsers only autoplay muted videos
//   loop        - keeps playing so you can just watch
//   autoPlay    - a wall of play buttons is useless when you're in a hurry
//   playsInline - without this iphones go fullscreen for every single tile
function SignalTile({ signal, videoUrl, posterUrl }: Props) {
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-card">
      <div className="aspect-square bg-ink">
        {videoUrl ? (
          <video
            src={videoUrl}
            poster={posterUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-label={'Clip: ' + signal.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm text-accent-ink">
            Video couldn't load
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="font-semibold">{signal.title}</p>
        <p className="mt-1">
          <span className="text-muted">Means: </span>
          {signal.meaning}
        </p>
        {signal.action && (
          <p className="mt-1">
            <span className="text-muted">Do: </span>
            {signal.action}
          </p>
        )}

        {/* little tags */}
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          <span className="rounded border border-line px-2 py-0.5 text-muted">
            {bodyRegionNames[signal.body_region]}
          </span>
          {signal.has_sound && (
            <span className="rounded border border-line px-2 py-0.5 text-muted">Sound</span>
          )}
          {signal.flacc_category && (
            <span className="rounded border border-bad px-2 py-0.5 text-bad">
              Pain sign · {flaccNames[signal.flacc_category]}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

export default SignalTile
