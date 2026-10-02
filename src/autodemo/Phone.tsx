import type { ReactNode } from 'react'
import { ease, useDemoTime } from './clock'

type Props = {
  label: string
  sublabel: string
  active: boolean
  // when the phone last buzzed (it shakes for a moment)
  buzzAt?: number | null
  children: ReactNode
  // stuff that sits on top of the screen, like a notification
  overlay?: ReactNode
}

// a phone-shaped frame around a screen
function Phone({ label, sublabel, active, buzzAt, children, overlay }: Props) {
  const { t } = useDemoTime()

  // shake left and right for 0.6s when it buzzes
  let shake = 0
  if (buzzAt != null && t >= buzzAt && t < buzzAt + 0.6) {
    const k = (t - buzzAt) / 0.6
    shake = Math.sin(k * Math.PI * 10) * 7 * (1 - k)
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{
        opacity: active ? 1 : 0.45,
        transform: `translateX(${shake}px) scale(${active ? 1 : 0.97})`,
        filter: active ? 'none' : 'saturate(0.6)',
      }}
    >
      <p className="text-center text-xl font-bold text-ink">{label}</p>
      <p className="mb-3 text-center text-base text-muted">{sublabel}</p>

      <div
        className="relative rounded-[56px] bg-[#111418] p-[12px]"
        style={{ boxShadow: active ? '0 30px 80px rgba(10,95,91,0.28), 0 8px 24px rgba(0,0,0,0.25)' : '0 12px 30px rgba(0,0,0,0.18)' }}
      >
        {/* the screen */}
        <div className="relative h-[760px] w-[352px] overflow-hidden rounded-[44px] bg-paper">
          {/* status bar */}
          <div className="flex h-[40px] items-center justify-between px-7 text-[13px] font-semibold text-ink">
            <span>2:14</span>
            <span className="h-[22px] w-[92px] rounded-full bg-[#111418]" />
            <span>●●● ▮</span>
          </div>
          <div className="absolute inset-x-0 top-[40px] bottom-0 overflow-hidden">{children}</div>
          {overlay}
        </div>
      </div>
    </div>
  )
}

// fades a screen in when it first shows up
export function Screen({ at, children }: { at: number; children: ReactNode }) {
  const { t } = useDemoTime()
  const k = ease(t, at, 0.3)
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}
    >
      {children}
    </div>
  )
}

export default Phone
