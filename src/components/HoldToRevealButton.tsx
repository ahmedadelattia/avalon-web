import { useState } from 'react'
import type { RolePowerText } from '../lib/types'

interface Props {
  roleKey: string
  roleLabel: string
  alignmentLabel: string
  power: RolePowerText
  visiblePlayers: string[]
}

export function HoldToRevealButton({
  roleKey,
  roleLabel,
  alignmentLabel,
  power,
  visiblePlayers,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <button
        type="button"
        className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 active:scale-[0.99]"
        onClick={() => setOpen((prev) => !prev)}
        aria-pressed={open}
      >
        {open ? 'Hide Role Details' : 'Reveal Role & Powers'}
      </button>
      {open ? (
        <div className="mt-3 rounded-lg bg-slate-950/80 p-3 text-sm">
          <div className="flex items-center gap-3">
            <img
              src={`/icons/roles/${roleKey}.svg`}
              alt=""
              className="h-10 w-10 rounded-md border border-slate-700 bg-slate-900 p-1"
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Role</p>
              <p className="text-lg font-semibold text-amber-300">{roleLabel}</p>
            </div>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mt-2">Team</p>
          <p className="font-medium text-slate-200">{alignmentLabel}</p>
          <p className="mt-2 text-slate-300">{power.short}</p>
          <p className="text-xs text-slate-400 mt-1">{power.detail}</p>
          {visiblePlayers.length > 0 ? (
            <p className="mt-2 text-xs text-amber-200">
              Known players: {visiblePlayers.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
