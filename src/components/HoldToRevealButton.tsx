import { useState } from 'react'
import type { ReactNode } from 'react'
import { getRolePortrait } from '../lib/roleAssets'
import type { Role, RolePowerText } from '../lib/types'

interface Props {
  roleKey: Role
  roleLabel: string
  alignmentLabel: string
  power: RolePowerText
  visiblePlayers: string[]
  belowPrimary?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function HoldToRevealButton({
  roleKey,
  roleLabel,
  alignmentLabel,
  power,
  visiblePlayers,
  belowPrimary,
  open,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen

  function setOpen(nextOpen: boolean) {
    if (open === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <button
        type="button"
        className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 active:scale-[0.99]"
        onClick={() => setOpen(!isOpen)}
        aria-pressed={isOpen}
      >
        {isOpen ? 'Hide Role Details' : 'Reveal Role & Powers'}
      </button>
      {belowPrimary ? <div className="mt-2">{belowPrimary}</div> : null}
      {isOpen ? (
        <div className="mt-3 rounded-lg bg-slate-950/80 p-3 text-sm">
          <div className="flex items-center gap-3">
            <img
              src={getRolePortrait(roleKey)}
              alt=""
              className="h-14 w-14 rounded-md border border-amber-700/70 bg-slate-900 object-cover"
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
