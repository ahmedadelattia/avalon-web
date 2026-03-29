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
  variant?: 'inline' | 'floating'
  floatingTopClass?: string
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
  variant = 'inline',
  floatingTopClass = 'top-[62%]',
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen

  function setOpen(nextOpen: boolean) {
    if (open === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  const details = (
    <div className="rounded-lg bg-slate-950/80 p-3 text-sm">
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
      <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Team</p>
      <p className="font-medium text-slate-200">{alignmentLabel}</p>
      <p className="mt-2 text-slate-300">{power.short}</p>
      <p className="mt-1 text-xs text-slate-400">{power.detail}</p>
      {visiblePlayers.length > 0 ? (
        <p className="mt-2 text-xs text-amber-200">
          Known players: {visiblePlayers.join(', ')}
        </p>
      ) : null}
    </div>
  )

  if (variant === 'floating') {
    return (
      <div className={`fixed right-0 z-[55] -translate-y-1/2 ${floatingTopClass}`}>
        {!isOpen ? (
          <button
            type="button"
            className="rounded-l-xl border border-r-0 border-slate-700 bg-amber-500 px-3 py-3 text-xs font-bold text-slate-950 shadow-lg"
            onClick={() => setOpen(true)}
            aria-label="Reveal Role & Powers"
          >
            Reveal
          </button>
        ) : (
          <div className="mr-2 w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl">
            <button
              type="button"
              className="mb-2 w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 active:scale-[0.99]"
              onClick={() => setOpen(false)}
              aria-pressed={isOpen}
            >
              Hide Role Details
            </button>
            {belowPrimary ? <div className="mb-2">{belowPrimary}</div> : null}
            {details}
          </div>
        )}
      </div>
    )
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
      {isOpen ? <div className="mt-3">{details}</div> : null}
    </div>
  )
}
