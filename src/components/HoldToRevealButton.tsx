import { useState } from 'react'
import type { RolePowerText } from '../lib/types'

interface Props {
  roleLabel: string
  alignmentLabel: string
  power: RolePowerText
}

export function HoldToRevealButton({ roleLabel, alignmentLabel, power }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <button
        type="button"
        className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 active:scale-[0.99]"
        onMouseDown={() => setOpen(true)}
        onMouseUp={() => setOpen(false)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        onTouchEnd={() => setOpen(false)}
        onTouchCancel={() => setOpen(false)}
        aria-pressed={open}
      >
        Hold to Reveal
      </button>
      {open ? (
        <div className="mt-3 rounded-lg bg-slate-950/80 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Role</p>
          <p className="text-lg font-semibold text-amber-300">{roleLabel}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400 mt-2">Team</p>
          <p className="font-medium text-slate-200">{alignmentLabel}</p>
          <p className="mt-2 text-slate-300">{power.short}</p>
          <p className="text-xs text-slate-400 mt-1">{power.detail}</p>
        </div>
      ) : null}
    </div>
  )
}
