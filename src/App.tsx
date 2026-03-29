import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HoldToRevealButton } from './components/HoldToRevealButton'
import {
  actorRole,
  isQuestMember,
  leaderActorId,
  roleLabel,
} from './lib/engine'
import {
  isValidRoomCode,
  normalizeRoomCode,
  randomRoomCode,
  ROOM_CODE_LENGTH,
} from './lib/room'
import { getRolePowerText, getQuestTeamSize, PLAYER_MATRIX } from './lib/rules'
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

type RoomEntry =
  | { ready: false }
  | {
      ready: true
      roomCode: string
      identity: PlayerIdentity
      isCreator: boolean
    }

function App() {
  const [displayName, setDisplayName] = useState(() => getStoredName())
  const [roomCodeInput, setRoomCodeInput] = useState('')
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
                const identityNext = createIdentity(displayName.trim())
                setEntry({
                  ready: true,
                  roomCode: randomRoomCode(),
                  identity: identityNext,
                  isCreator: true,
                })
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
                    normalizeRoomCode(event.target.value).slice(
                      0,
                      ROOM_CODE_LENGTH,
                    ),
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
                  const identityNext = createIdentity(displayName.trim())
                  setEntry({
                    ready: true,
                    roomCode: normalizedRoomInput.slice(0, ROOM_CODE_LENGTH),
                    identity: identityNext,
                    isCreator: false,
                  })
                }}
              >
                Join Room
              </button>
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
        </header>

        {myRole &&
        state.phase !== 'lobby' &&
        state.phase !== 'private_reveal' ? (
          <HoldToRevealButton
            roleLabel={roleLabel(myRole.role)}
            alignmentLabel={myRole.alignment.toUpperCase()}
            power={getRolePowerText(myRole.role)}
          />
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
                  <div className="grid grid-cols-2 gap-2">
                    {state.players.map((player) => {
                      const selected = teamDraft.includes(player.actorId)
                      return (
                        <button
                          key={player.actorId}
                          className={`rounded-lg border px-2 py-2 text-left ${
                            selected
                              ? 'border-amber-400 bg-amber-400/20'
                              : 'border-slate-700 bg-slate-900/50'
                          }`}
                          onClick={() => {
                            setTeamDraft((prev) => {
                              if (prev.includes(player.actorId)) {
                                return prev.filter((id) => id !== player.actorId)
                              }
                              return [...prev, player.actorId]
                            })
                          }}
                        >
                          {player.displayName}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950"
                    onClick={() => dispatch({ type: 'propose_team', actorId: identity.actorId, team: teamDraft })}
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
