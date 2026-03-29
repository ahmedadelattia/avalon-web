import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { InviteTools } from './components/InviteTools'
import { HoldToRevealButton } from './components/HoldToRevealButton'
import {
  actorRole,
  isQuestMember,
  leaderActorId,
  roleLabel,
} from './lib/engine'
import {
  extractRoomCodeFromLocation,
  isValidRoomCode,
  isSoloTestRoomCode,
  normalizeRoomCode,
  randomRoomCode,
  ROOM_CODE_LENGTH,
  SOLO_TEST_ROOM_CODE,
} from './lib/room'
import { getRolePowerText, getQuestTeamSize, PLAYER_MATRIX } from './lib/rules'
import { getRolePortrait } from './lib/roleAssets'
import { createIdentity, getStoredName } from './lib/storage'
import { currentTimeMs } from './lib/time'
import type { EngineAction, PlayerIdentity } from './lib/types'
import { useRoomSync } from './hooks/useRoomSync'

type WithoutNow<T> = T extends { now: number } ? Omit<T, 'now'> : never
type EngineActionInput = WithoutNow<EngineAction>

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-black/20">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function QuestTrack({
  outcomes,
  currentQuest,
}: {
  outcomes: Array<{ success: boolean }>
  currentQuest: number
}) {
  return (
    <div className="rounded-2xl border border-amber-800/40 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
        Quest Track
      </p>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, idx) => {
          const questNum = idx + 1
          const done = idx < outcomes.length
          const outcome = outcomes[idx]
          const icon = done
            ? outcome.success
              ? '/icons/status/pass.svg'
              : '/icons/status/fail.svg'
            : '/icons/status/pending.svg'
          const label = done ? (outcome.success ? 'Pass' : 'Fail') : 'Pending'
          const isCurrent = !done && questNum === currentQuest
          return (
            <div
              key={questNum}
              className={`rounded-xl border p-2 text-center ${
                isCurrent
                  ? 'border-amber-400 bg-amber-400/10'
                  : 'border-slate-700 bg-slate-950/50'
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Q{questNum}
              </p>
              <img
                src={icon}
                alt={label}
                className="mx-auto mt-1 h-8 w-8 rounded-md border border-slate-700 bg-slate-900 p-1"
              />
              <p className="mt-1 text-[10px] text-slate-300">{label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RoundTable({
  players,
  teamIds,
  leaderId,
  highlightIds,
  selectableActorIds = [],
  disabledActorIds = [],
  onPlayerClick,
}: {
  players: Array<{
    actorId: string
    displayName: string
    connected: boolean
  }>
  teamIds: string[]
  leaderId: string | null
  highlightIds: string[]
  selectableActorIds?: string[]
  disabledActorIds?: string[]
  onPlayerClick?: (actorId: string) => void
}) {
  const radius = 38
  const center = 50
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
        Round Table
      </p>
      <div className="relative mx-auto mt-4 aspect-square w-full max-w-[21rem] rounded-full border-2 border-amber-900/40 bg-[radial-gradient(circle,#0f172a,#020617)]">
        <div className="absolute inset-[22%] rounded-full border border-slate-700 bg-slate-950/40" />
        {players.map((player, index) => {
          const angle = (index / players.length) * Math.PI * 2 - Math.PI / 2
          const x = center + radius * Math.cos(angle)
          const y = center + radius * Math.sin(angle)
          const onTeam = teamIds.includes(player.actorId)
          const isLeader = leaderId === player.actorId
          const highlighted = highlightIds.includes(player.actorId)
          const isSelectable = selectableActorIds.includes(player.actorId)
          const isDisabled = disabledActorIds.includes(player.actorId)
          const interactive = Boolean(onPlayerClick && isSelectable)
          return (
            <div
              key={player.actorId}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <button
                type="button"
                disabled={!interactive || isDisabled}
                onClick={() => {
                  if (!interactive || isDisabled || !onPlayerClick) return
                  onPlayerClick(player.actorId)
                }}
                className={`w-20 rounded-lg border px-2 py-1 text-center text-[11px] ${
                  highlighted
                    ? 'border-amber-300 bg-amber-300/20'
                    : onTeam
                      ? 'border-emerald-400 bg-emerald-400/15'
                      : 'border-slate-700 bg-slate-950/70'
                } ${
                  interactive
                    ? 'cursor-pointer active:scale-[0.98]'
                    : ''
                } ${
                  isDisabled ? 'opacity-45' : ''
                }`}
              >
                <p className="truncate font-semibold text-slate-100">
                  {player.displayName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {isLeader
                    ? 'Leader'
                    : !player.connected
                      ? 'Offline'
                      : onTeam
                        ? 'On Team'
                        : isSelectable
                          ? 'Tap to Add'
                        : 'Player'}
                </p>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type RoomEntry =
  | { ready: false }
  | {
      ready: true
      roomCode: string
      identity: PlayerIdentity
      isCreator: boolean
    }

const SOLO_BOTS = [
  { actorId: 'solo-bot-1', displayName: 'Bot 1' },
  { actorId: 'solo-bot-2', displayName: 'Bot 2' },
  { actorId: 'solo-bot-3', displayName: 'Bot 3' },
  { actorId: 'solo-bot-4', displayName: 'Bot 4' },
] as const

function App() {
  const optionalRoleIconByKey: Record<string, string> = {
    mordred: getRolePortrait('mordred'),
    oberon: getRolePortrait('oberon'),
    morgana: getRolePortrait('morgana'),
    percival: getRolePortrait('percival'),
    ladyOfTheLake: '/icons/features/lady_of_lake.webp',
  }

  const deepLinkRoomCode = useMemo(() => {
    if (typeof window === 'undefined') return null
    return extractRoomCodeFromLocation(window.location)
  }, [])

  const [displayName, setDisplayName] = useState(() => getStoredName())
  const [roomCodeInput, setRoomCodeInput] = useState(() => deepLinkRoomCode ?? '')
  const [entry, setEntry] = useState<RoomEntry>({ ready: false })
  const [teamDraft, setTeamDraft] = useState<string[]>([])
  const localIdentity = useMemo(() => createIdentity('Local Player'), [])
  const normalizedRoomInput = useMemo(
    () => normalizeRoomCode(roomCodeInput),
    [roomCodeInput],
  )

  const sync = useRoomSync(
    entry.ready
      ? {
          roomCode: entry.roomCode,
          identity: entry.identity,
          isCreator: entry.isCreator,
        }
      : {
          roomCode: 'LOCAL00',
          identity: localIdentity,
          isCreator: true,
        },
  )

  const state = entry.ready ? sync.state : null
  const identity = entry.ready ? entry.identity : null
  const isSoloTestRoom = entry.ready
    ? isSoloTestRoomCode(entry.roomCode)
    : false

  const myRole = useMemo(() => {
    if (!state || !identity) return undefined
    return actorRole(state, identity.actorId)
  }, [identity, state])

  const myVisibility = useMemo(() => {
    if (!state || !identity || !state.visibility) return null
    return state.visibility.byActorId[identity.actorId] ?? null
  }, [identity, state])

  const connectedPlayers = state?.players.filter((p) => p.connected).length ?? 0

  const leaderId = state ? leaderActorId(state) : null
  const isLeader = Boolean(identity && leaderId === identity.actorId)

  async function dispatch(action: EngineActionInput) {
    if (!entry.ready) return
    await sync.dispatch({ ...action, now: currentTimeMs() } as EngineAction)
  }

  useEffect(() => {
    if (!state) return
    if (state.phase !== 'team_proposal') {
      setTeamDraft([])
    }
  }, [state?.phase])

  useEffect(() => {
    if (!isSoloTestRoom || !state || !identity) return

    if (state.phase === 'lobby' && state.players.length < 5) {
      const existingIds = new Set(state.players.map((p) => p.actorId))
      for (const bot of SOLO_BOTS) {
        if (!existingIds.has(bot.actorId)) {
          void dispatch({
            type: 'player_join',
            actorId: bot.actorId,
            displayName: bot.displayName,
          })
        }
      }
      return
    }

    if (state.phase === 'private_reveal') {
      for (const bot of SOLO_BOTS) {
        if (state.revealDismissedBy.includes(bot.actorId)) continue
        if (!state.players.some((p) => p.actorId === bot.actorId)) continue
        void dispatch({ type: 'dismiss_reveal', actorId: bot.actorId })
      }
      return
    }

    if (state.phase === 'proposal_vote') {
      for (const bot of SOLO_BOTS) {
        if (!(bot.actorId in state.round.proposalVotes)) {
          void dispatch({
            type: 'cast_proposal_vote',
            actorId: bot.actorId,
            approve: true,
          })
        }
      }
      return
    }

    if (state.phase === 'quest_vote') {
      for (const bot of SOLO_BOTS) {
        if (!state.round.proposedTeam.includes(bot.actorId)) continue
        if (bot.actorId in state.round.questVotes) continue
        void dispatch({
          type: 'cast_quest_vote',
          actorId: bot.actorId,
          card: 'success',
        })
      }
    }
  }, [dispatch, identity, isSoloTestRoom, state])

  function writeRoomToUrl(code: string) {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.pathname = '/'
    url.search = `?room=${normalizeRoomCode(code).slice(0, ROOM_CODE_LENGTH)}`
    window.history.replaceState({}, '', url.toString())
  }

  if (!entry.ready) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl bg-[radial-gradient(circle_at_top,#172554,transparent_60%),linear-gradient(170deg,#020617,#0f172a)] px-4 py-8 text-slate-100">
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Avalon</p>
            <h1 className="text-3xl font-black leading-tight">Mobile Command Table</h1>
            <p className="text-sm text-slate-300">
              Browser-only social deduction with private role reveals and synchronized turns.
            </p>
          </header>

          <Section title="Enter Player Name">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
              placeholder="Your name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Section>

          <Section title="Create Room">
            <button
              className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
              disabled={displayName.trim().length < 2}
              onClick={() => {
                const roomCode = randomRoomCode()
                const identityNext = createIdentity(displayName.trim())
                setEntry({
                  ready: true,
                  roomCode,
                  identity: identityNext,
                  isCreator: true,
                })
                writeRoomToUrl(roomCode)
              }}
            >
              Create New Room
            </button>
          </Section>

          <Section title="Join Room">
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 uppercase"
                placeholder="Room code"
                value={roomCodeInput}
                onChange={(event) =>
                  setRoomCodeInput(
                    normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_LENGTH),
                  )
                }
              />
              <button
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
                disabled={
                  displayName.trim().length < 2 ||
                  !isValidRoomCode(normalizedRoomInput)
                }
                onClick={() => {
                  const roomCode = isSoloTestRoomCode(normalizedRoomInput)
                    ? SOLO_TEST_ROOM_CODE
                    : normalizedRoomInput.slice(0, ROOM_CODE_LENGTH)
                  const identityNext = createIdentity(displayName.trim())
                  setEntry({
                    ready: true,
                    roomCode,
                    identity: identityNext,
                    isCreator: false,
                  })
                  writeRoomToUrl(roomCode)
                }}
              >
                Join Room
              </button>
              {deepLinkRoomCode ? (
                <p className="text-xs text-slate-400">
                  Shared room detected: <strong>{deepLinkRoomCode}</strong>
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Solo test shortcut: enter <strong>{SOLO_TEST_ROOM_CODE}</strong> to auto-add 4 bots.
              </p>
            </div>
          </Section>
        </div>
      </main>
    )
  }

  if (!state || !identity) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl px-4 py-8 text-slate-100 bg-slate-950">
        <p className="text-sm text-slate-300">Connecting room...</p>
      </main>
    )
  }

  const playerCount = state.players.length
  const canStart = Boolean(PLAYER_MATRIX[playerCount])
  const canPlayFail =
    myRole?.alignment === 'evil' || state.room.houseRules.allowGoodFail
  const isGameplayPhase =
    state.phase !== 'lobby' && state.phase !== 'private_reveal'
  const teamSizeRequired = PLAYER_MATRIX[state.players.length]
    ? getQuestTeamSize(state.players.length, state.round.questNumber)
    : 0
  const canInteractWithRoundTable = state.phase === 'team_proposal' && isLeader
  const roundTableTeamIds =
    state.phase === 'team_proposal' ? teamDraft : state.round.proposedTeam
  const teamDraftLimitReached = teamDraft.length >= teamSizeRequired
  const roundTableDisabledIds = canInteractWithRoundTable
    ? state.players
        .filter((player) => !teamDraft.includes(player.actorId) && teamDraftLimitReached)
        .map((player) => player.actorId)
    : []

  const visiblePlayerIds = myVisibility
    ? [...myVisibility.seesEvilIds, ...myVisibility.seesMerlinOrMorganaIds]
    : []
  const visiblePlayerNames = visiblePlayerIds
    .map(
      (id) =>
        state.players.find((player) => player.actorId === id)?.displayName ?? id,
    )
    .filter((name, index, arr) => arr.indexOf(name) === index)

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-[radial-gradient(circle_at_top,#172554,transparent_65%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-6 text-slate-100">
      <div className="space-y-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Room</p>
              <p className="text-2xl font-black tracking-wider">{state.room.roomCode}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>{sync.transportText}</p>
              <p>{connectedPlayers}/{state.players.length} connected</p>
              <p>Host epoch {state.hostEpoch}</p>
            </div>
          </div>
          {sync.error ? <p className="mt-2 text-xs text-rose-300">{sync.error}</p> : null}
          <div className="mt-3">
            <InviteTools roomCode={state.room.roomCode} />
          </div>
        </header>

        {isGameplayPhase ? (
          <>
            <QuestTrack
              outcomes={state.round.questOutcomes}
              currentQuest={state.round.questNumber}
            />
            <RoundTable
              players={state.players}
              teamIds={roundTableTeamIds}
              leaderId={leaderId}
              highlightIds={visiblePlayerIds}
              selectableActorIds={canInteractWithRoundTable ? state.players.map((p) => p.actorId) : []}
              disabledActorIds={roundTableDisabledIds}
              onPlayerClick={(actorId) => {
                if (!canInteractWithRoundTable) return
                setTeamDraft((prev) => {
                  if (prev.includes(actorId)) {
                    return prev.filter((id) => id !== actorId)
                  }
                  if (prev.length >= teamSizeRequired) {
                    return prev
                  }
                  return [...prev, actorId]
                })
              }}
            />
            {myRole ? (
              <HoldToRevealButton
                roleKey={myRole.role}
                roleLabel={roleLabel(myRole.role)}
                alignmentLabel={myRole.alignment.toUpperCase()}
                power={getRolePowerText(myRole.role)}
                visiblePlayers={visiblePlayerNames}
              />
            ) : null}
          </>
        ) : null}

        {state.phase === 'lobby' ? (
          <Section title="Lobby">
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                {canStart
                  ? `${playerCount} players ready. Avalon supports 5 to 10 players.`
                  : `Need 5-10 players. Current: ${playerCount}`}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {state.players.map((player) => (
                  <div
                    key={player.actorId}
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2"
                  >
                    <p className="font-semibold text-slate-200">{player.displayName}</p>
                    <p className="text-slate-400">{player.connected ? 'Online' : 'Offline'}</p>
                    <p className="text-amber-300">{player.isHost ? 'Host' : `Seat ${player.joinOrder + 1}`}</p>
                  </div>
                ))}
              </div>

              {state.hostActorId === identity.actorId ? (
                <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Role Toggles</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      ['mordred', 'Mordred'],
                        ['oberon', 'Oberon'],
                        ['morgana', 'Morgana'],
                        ['percival', 'Percival'],
                        ['ladyOfTheLake', 'Lady of the Lake'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 rounded-lg bg-slate-900/70 p-2">
                        <input
                          type="checkbox"
                          checked={state.room.enabledRoles[key]}
                          onChange={(event) => {
                            dispatch({
                              type: 'update_roles',
                              actorId: identity.actorId,
                              enabledRoles: {
                                ...state.room.enabledRoles,
                                [key]: event.target.checked,
                              },
                            })
                          }}
                        />
                        <img
                          src={optionalRoleIconByKey[key]}
                          alt=""
                          className="h-8 w-8 rounded-md border border-slate-700 object-cover"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <label className="block space-y-2 text-sm">
                    <span>Assassination Mode</span>
                    <select
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                      value={state.room.houseRules.assassinationMode}
                      onChange={(event) => {
                        dispatch({
                          type: 'update_house_rules',
                          actorId: identity.actorId,
                          houseRules: {
                            assassinationMode: event.target.value as
                              | 'official'
                              | 'evil_confirm_majority_excl_oberon',
                          },
                        })
                      }}
                    >
                      <option value="evil_confirm_majority_excl_oberon">
                        Evil confirm majority (default)
                      </option>
                      <option value="official">Official (Assassin only)</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg bg-slate-900/70 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={state.room.houseRules.allowGoodFail}
                      onChange={(event) => {
                        dispatch({
                          type: 'update_house_rules',
                          actorId: identity.actorId,
                          houseRules: {
                            allowGoodFail: event.target.checked,
                          },
                        })
                      }}
                    />
                    <span>Allow good players to vote Fail</span>
                  </label>

                  <button
                    className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
                    disabled={!canStart}
                    onClick={() => dispatch({ type: 'start_game', actorId: identity.actorId })}
                  >
                    Start Game
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Host configures roles and starts the game.</p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'private_reveal' && myRole ? (
          <Section title="Private Reveal">
            <div className="space-y-3 text-sm">
              <p className="text-slate-300">Role: <strong>{roleLabel(myRole.role)}</strong></p>
              <p className="text-slate-300">Team: <strong>{myRole.alignment.toUpperCase()}</strong></p>
              {myVisibility ? (
                <div className="rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
                  {myVisibility.seesEvilIds.length > 0 ? (
                    <p>
                      You see evil: {myVisibility.seesEvilIds
                        .map((id) => state.players.find((p) => p.actorId === id)?.displayName ?? id)
                        .join(', ')}
                    </p>
                  ) : null}
                  {myVisibility.seesMerlinOrMorganaIds.length > 0 ? (
                    <p className="mt-1">
                      Merlin candidates: {myVisibility.seesMerlinOrMorganaIds
                        .map((id) => state.players.find((p) => p.actorId === id)?.displayName ?? id)
                        .join(', ')}
                    </p>
                  ) : null}
                  {myVisibility.seesEvilIds.length === 0 &&
                  myVisibility.seesMerlinOrMorganaIds.length === 0 ? (
                    <p>No private intel.</p>
                  ) : null}
                </div>
              ) : null}
              {!state.revealDismissedBy.includes(identity.actorId) ? (
                <button
                  className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950"
                  onClick={() => dispatch({ type: 'dismiss_reveal', actorId: identity.actorId })}
                >
                  Confirm to Continue
                </button>
              ) : (
                <p className="text-xs text-slate-400">
                  Waiting for others to confirm ({state.revealDismissedBy.length}/{state.players.length})
                </p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'team_proposal' ? (
          <Section title={`Quest ${state.round.questNumber}: Team Proposal`}>
            <div className="space-y-3 text-sm">
              <p>
                Leader:{' '}
                <strong>
                  {state.players.find((p) => p.actorId === leaderId)?.displayName ?? 'Unknown'}
                </strong>
              </p>
              <p>Quest size: {getQuestTeamSize(state.players.length, state.round.questNumber)}</p>
              <p>Rejected proposals this round: {state.round.rejectionCount}/5</p>

              {isLeader ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Tap players on the round table to choose the quest team.
                    Selected: {teamDraft.length}/{teamSizeRequired}
                  </p>

                  <button
                    className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
                    disabled={teamDraft.length !== teamSizeRequired}
                    onClick={() =>
                      dispatch({
                        type: 'propose_team',
                        actorId: isSoloTestRoom && leaderId ? leaderId : identity.actorId,
                        team: teamDraft,
                      })
                    }
                  >
                    Submit Team
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Waiting for leader to propose a team.</p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'proposal_vote' ? (
          <Section title="Proposal Vote">
            <div className="space-y-3 text-sm">
              <p>
                Proposed team:{' '}
                {state.round.proposedTeam
                  .map((id) => state.players.find((p) => p.actorId === id)?.displayName ?? id)
                  .join(', ')}
              </p>
              {!Object.hasOwn(state.round.proposalVotes, identity.actorId) ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-lg bg-emerald-400 px-3 py-3 font-semibold text-slate-950"
                    onClick={() => dispatch({ type: 'cast_proposal_vote', actorId: identity.actorId, approve: true })}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-lg bg-rose-400 px-3 py-3 font-semibold text-slate-950"
                    onClick={() => dispatch({ type: 'cast_proposal_vote', actorId: identity.actorId, approve: false })}
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Vote locked. Waiting for all players.</p>
              )}

              <div className="rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300">
                <p>Votes reveal only after all players vote.</p>
                <p>Submitted: {Object.keys(state.round.proposalVotes).length}/{state.players.length}</p>
              </div>
            </div>
          </Section>
        ) : null}

        {state.phase === 'quest_vote' ? (
          <Section title={`Quest ${state.round.questNumber}: Secret Quest Vote`}>
            <div className="space-y-3 text-sm">
              <p>
                Team:{' '}
                {state.round.proposedTeam
                  .map((id) => state.players.find((p) => p.actorId === id)?.displayName ?? id)
                  .join(', ')}
              </p>

              {isQuestMember(state, identity.actorId) ? (
                Object.hasOwn(state.round.questVotes, identity.actorId) ? (
                  <p className="text-xs text-slate-400">Quest card submitted. Waiting for others.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="rounded-lg bg-emerald-400 px-3 py-3 font-semibold text-slate-950"
                      onClick={() => dispatch({ type: 'cast_quest_vote', actorId: identity.actorId, card: 'success' })}
                    >
                      Success
                    </button>
                    <button
                      className="rounded-lg bg-rose-400 px-3 py-3 font-semibold text-slate-950 disabled:opacity-50"
                      disabled={!canPlayFail}
                      onClick={() => dispatch({ type: 'cast_quest_vote', actorId: identity.actorId, card: 'fail' })}
                    >
                      Fail
                    </button>
                  </div>
                )
              ) : (
                <p className="text-xs text-slate-400">You are not on this quest team.</p>
              )}

              {!canPlayFail ? (
                <p className="text-xs text-slate-400">
                  Good fail voting is disabled by lobby rules.
                </p>
              ) : null}

              <p className="text-xs text-slate-400">
                Individual quest cards remain secret. Only aggregate fail count is revealed.
              </p>
            </div>
          </Section>
        ) : null}

        {state.phase === 'lady_of_lake' ? (
          <Section title="Lady of the Lake">
            <div className="space-y-3 text-sm">
              <p>
                Holder:{' '}
                <strong>
                  {state.players.find((p) => p.actorId === state.round.ladyHolderId)?.displayName ?? 'Unknown'}
                </strong>
              </p>
              {state.round.ladyHolderId === identity.actorId ? (
                <div className="grid grid-cols-2 gap-2">
                  {state.players
                    .filter((p) => !state.round.ladyCheckedIds.includes(p.actorId) && p.actorId !== identity.actorId)
                    .map((player) => (
                      <button
                        key={player.actorId}
                        className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-left"
                        onClick={() => dispatch({ type: 'lady_peek', actorId: identity.actorId, targetId: player.actorId })}
                      >
                        Inspect {player.displayName}
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Waiting for Lady holder action.</p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'assassination' ? (
          <Section title="Assassination Phase">
            <div className="space-y-3 text-sm">
              <p>
                Assassin:{' '}
                <strong>
                  {state.players.find((p) => p.actorId === state.assassination?.assassinId)?.displayName}
                </strong>
              </p>

              {state.assassination?.assassinId === identity.actorId ? (
                <div className="grid grid-cols-2 gap-2">
                  {state.players
                    .filter((p) => actorRole(state, p.actorId)?.alignment === 'good')
                    .map((player) => (
                      <button
                        key={player.actorId}
                        className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-left"
                        onClick={() =>
                          dispatch({
                            type: 'assassination_nominate',
                            actorId: identity.actorId,
                            suspectId: player.actorId,
                          })
                        }
                      >
                        Nominate {player.displayName}
                      </button>
                    ))}
                </div>
              ) : null}

              {state.assassination?.suspectId ? (
                <p>
                  Suspect:{' '}
                  <strong>
                    {state.players.find((p) => p.actorId === state.assassination?.suspectId)?.displayName}
                  </strong>
                </p>
              ) : (
                <p className="text-xs text-slate-400">Waiting for assassin nomination.</p>
              )}

              {state.room.houseRules.assassinationMode === 'evil_confirm_majority_excl_oberon' &&
              state.assassination?.suspectId ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Eligible evil voters (except Oberon): {state.assassination.eligibleVoters.length}
                  </p>
                  {state.assassination.eligibleVoters.includes(identity.actorId) &&
                  !Object.hasOwn(state.assassination.votes, identity.actorId) ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="rounded-lg bg-emerald-400 px-3 py-3 font-semibold text-slate-950"
                        onClick={() =>
                          dispatch({
                            type: 'assassination_confirm_vote',
                            actorId: identity.actorId,
                            vote: 'confirm',
                          })
                        }
                      >
                        Confirm
                      </button>
                      <button
                        className="rounded-lg bg-rose-400 px-3 py-3 font-semibold text-slate-950"
                        onClick={() =>
                          dispatch({
                            type: 'assassination_confirm_vote',
                            actorId: identity.actorId,
                            vote: 'reject',
                          })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Waiting for evil confirmation votes.</p>
                  )}
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {state.phase === 'game_end' ? (
          <Section title="Game Result">
            <div className="space-y-2">
              <p className="text-2xl font-black">
                {state.winner === 'good' ? 'Good Wins' : 'Evil Wins'}
              </p>
              <p className="text-sm text-slate-300">{state.winningReason}</p>
              <div className="rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
                {state.assignments.map((assignment) => (
                  <p key={assignment.actorId}>
                    {state.players.find((p) => p.actorId === assignment.actorId)?.displayName}:{' '}
                    {roleLabel(assignment.role)} ({assignment.alignment})
                  </p>
                ))}
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="Quest Log">
          <div className="space-y-2 text-sm">
            {state.round.questOutcomes.length === 0 ? (
              <p className="text-slate-400">No completed quests yet.</p>
            ) : (
              state.round.questOutcomes.map((quest) => (
                <div key={quest.questNumber} className="rounded-lg bg-slate-950/50 p-2">
                  <p>
                    Quest {quest.questNumber}: {quest.success ? 'Success' : 'Fail'} ({quest.failCount} fail)
                  </p>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>
    </main>
  )
}

export default App
