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

// Shared parchment panel used for all game panels (votes, results, info sections).
// Navy header band + warm parchment body + optional darker footer strip.
function ParchmentPanel({
  label,
  children,
  footer,
}: {
  label: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      className="overflow-hidden rounded border border-[#2d4a6a]"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
    >
      <div className="bg-[#1a2d4a] px-4 py-2 text-center">
        <span className="font-serif text-[11px] font-bold uppercase tracking-widest text-[#e8c8b0]">
          {label}
        </span>
      </div>
      <div className="bg-[#e8e0d0] px-4 py-4 text-[#1a1208]">{children}</div>
      {footer ? (
        <div className="bg-[#d4ccbe] px-4 py-2.5 text-center text-xs text-[#3a3a4a]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

// Alias kept for non-vote informational sections (same panel, thinner padding).
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ParchmentPanel label={title}>
      <div className="text-[#1e1408]">{children}</div>
    </ParchmentPanel>
  )
}

// Used for proposal_vote and quest_vote action panels.
function ActionPanel({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string
  subtitle?: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <ParchmentPanel label={title} footer={footer}>
      {subtitle ? (
        <p className="mb-4 text-center text-sm text-[#3a4a5a]">{subtitle}</p>
      ) : null}
      {children}
    </ParchmentPanel>
  )
}

function VoteButton({
  label,
  icon,
  tone,
  onClick,
  disabled = false,
}: {
  label: string
  icon: string
  tone: 'approve' | 'reject' | 'success' | 'fail'
  onClick: () => void
  disabled?: boolean
}) {
  const styles = {
    approve: 'border-[#267238] bg-[#1c5226] text-white hover:bg-[#236030]',
    reject:  'border-[#9a2828] bg-[#7a1a1a] text-[#f5d0d0] hover:bg-[#8a2020]',
    success: 'border-[#267238] bg-[#1c5226] text-white hover:bg-[#236030]',
    fail:    'border-[#9a2828] bg-[#7a1a1a] text-[#f5d0d0] hover:bg-[#8a2020]',
  } as const

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border-2 px-4 py-5 transition-colors active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${styles[tone]}`}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl leading-none">{icon}</span>
        <span className="font-serif text-lg font-bold uppercase tracking-wide">{label}</span>
      </div>
    </button>
  )
}

// Large result icon displayed directly on parchment — no surrounding box.
function ResultIcon({ success }: { success: boolean }) {
  return (
    <div className={`text-center text-8xl leading-none ${success ? 'text-[#267a32]' : 'text-[#8a1e1e]'}`}>
      {success ? '✓' : '✕'}
    </div>
  )
}

function TeamResultPanel({ approved }: { approved: boolean }) {
  return (
    <ParchmentPanel label="Voting Result">
      <div className="space-y-3 py-1 text-center">
        <p
          className={`font-serif text-2xl font-black uppercase tracking-wide ${
            approved ? 'text-[#1a4a1e]' : 'text-[#6a1010]'
          }`}
        >
          {approved ? 'Team Approved' : 'Team Rejected'}
        </p>
        <ResultIcon success={approved} />
      </div>
    </ParchmentPanel>
  )
}

function QuestResultPanel({
  outcome,
}: {
  outcome: { success: boolean; failCount: number; questNumber: number }
}) {
  const failLabel =
    outcome.failCount === 0
      ? 'No fail cards played.'
      : `${outcome.failCount} fail card${outcome.failCount > 1 ? 's' : ''} played.`
  return (
    <ParchmentPanel label={`Quest ${outcome.questNumber}`}>
      <div className="space-y-3 py-1 text-center">
        <p
          className={`font-serif text-2xl font-black uppercase tracking-wide ${
            outcome.success ? 'text-[#1a4a1e]' : 'text-[#6a1010]'
          }`}
        >
          {outcome.success ? 'Task Passed' : 'Task Failed'}
        </p>
        <ResultIcon success={outcome.success} />
        <p className="text-sm text-[#3a4a5a]">{failLabel}</p>
      </div>
    </ParchmentPanel>
  )
}

function QuestTrack({
  outcomes,
  currentQuest,
  playerCount,
}: {
  outcomes: Array<{ success: boolean }>
  currentQuest: number
  playerCount: number
}) {
  return (
    <div
      className="overflow-hidden rounded border border-[#2d4a6a]"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
    >
      <div className="bg-[#1a2d4a] px-3 py-1.5 text-center">
        <span className="font-serif text-[10px] font-bold uppercase tracking-widest text-[#e8c8b0]">
          Quest Track
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 bg-[#d4ccbe] p-2">
        {Array.from({ length: 5 }, (_, idx) => {
          const questNum = idx + 1
          const done = idx < outcomes.length
          const outcome = outcomes[idx]
          const icon = done
            ? outcome.success
              ? '/icons/status/pass.png'
              : '/icons/status/fail.png'
            : null
          const label = done ? (outcome.success ? 'Pass' : 'Fail') : 'Pending'
          const isCurrent = !done && questNum === currentQuest
          const teamSize = getQuestTeamSize(playerCount, questNum)
          return (
            <div
              key={questNum}
              className={`rounded border p-1.5 text-center ${
                isCurrent
                  ? 'border-[#2d4a6a] bg-[#e8e0d0]'
                  : 'border-[#2d4a6a]/30 bg-[#ccc4b8]/60'
              }`}
            >
              {icon ? (
                <img src={icon} alt={label} className="mx-auto h-8 w-8 rounded-sm" />
              ) : (
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-sm border border-[#2d4a6a]/40 font-serif text-xs font-bold text-[#1a1208]">
                  {teamSize}
                </div>
              )}
              <p className="mt-0.5 font-serif text-[9px] font-bold uppercase text-[#2d3a4a]">
                Q{questNum}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RejectionTrack({ rejectionCount }: { rejectionCount: number }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: 5 }, (_, idx) => {
        const attempt = idx + 1
        const rejected = attempt <= rejectionCount
        return (
          <div key={attempt} className="rounded border border-[#2d4a6a]/30 bg-[#d4ccbe]/50 p-2">
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border font-serif text-xs font-bold ${
                rejected
                  ? 'border-[#9a2828] bg-[#7a1a1a] text-[#f5d0d0]'
                  : 'border-[#2d4a6a]/40 text-[#2d3a4a]'
              }`}
            >
              {attempt}
            </div>
          </div>
        )
      })}
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
  selectableHint = 'Tap to Add',
  statusByActorId = {},
  statusToneByActorId = {},
  darkMode = true,
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
  selectableHint?: string
  statusByActorId?: Record<string, string>
  statusToneByActorId?: Record<string, 'good' | 'evil'>
  darkMode?: boolean
}) {
  const radius = 38
  const center = 50
  return (
    <div
      className={`overflow-hidden rounded border border-[#2d4a6a] p-2 ${
        darkMode ? 'bg-[#0a0f1a]' : 'bg-[#d4ccbe]'
      }`}
    >
      <div
        className={`relative mx-auto aspect-square w-full max-w-[21rem] rounded-full border border-[#1e3050] ${
          darkMode ? 'bg-[#0d1623]' : 'bg-[#1a2d4a]'
        }`}
      >
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
          const statusTone = statusToneByActorId[player.actorId]

          let chipBg: string
          let nameColor: string
          if (highlighted) {
            chipBg = 'border-[#9a2828] bg-[#7a1a1a]'
            nameColor = 'text-[#f5d0d0]'
          } else if (onTeam) {
            chipBg = 'border-[#267238] bg-[#1c5226]'
            nameColor = 'text-white'
          } else if (darkMode) {
            chipBg = 'border-[#2d4a6a] bg-[#0f1a2e]'
            nameColor = 'text-[#c8d8e8]'
          } else {
            chipBg = 'border-[#2d4a6a] bg-[#1a2d4a]'
            nameColor = 'text-[#e8e0d0]'
          }

          const statusColor =
            statusTone === 'good'
              ? 'text-[#4ade80]'
              : statusTone === 'evil'
                ? 'text-[#f87171]'
                : darkMode
                  ? 'text-[#7a9ab8]'
                  : 'text-[#a8bcd0]'

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
                className={`w-20 rounded border-2 px-2 py-1 text-center ${chipBg} ${
                  interactive ? 'cursor-pointer active:scale-[0.98]' : ''
                } ${isDisabled ? 'opacity-45' : ''}`}
              >
                <p className={`truncate text-[11px] font-semibold ${nameColor}`}>
                  {player.displayName}
                </p>
                <p className={`text-[10px] ${statusColor}`}>
                  {statusByActorId[player.actorId]
                    ? statusByActorId[player.actorId]
                    : isLeader
                      ? 'Leader'
                      : !player.connected
                        ? 'Offline'
                        : onTeam
                          ? 'On Team'
                          : isSelectable
                            ? selectableHint
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

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const [displayName, setDisplayName] = useState(() => getStoredName())
  const [roomCodeInput, setRoomCodeInput] = useState(() => deepLinkRoomCode ?? '')
  const [entry, setEntry] = useState<RoomEntry>({ ready: false })
  const [teamDraft, setTeamDraft] = useState<string[]>([])
  const [isRevealOpen, setIsRevealOpen] = useState(false)
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
    setIsRevealOpen(false)
  }, [state?.phase])

  useEffect(() => {
    if (!state || !identity) return
    if (state.phase !== 'assassination' || !state.assassination) return
    if (state.room.houseRules.assassinationMode !== 'evil_confirm_majority_excl_oberon') return

    const delay = Math.max(0, state.assassination.deadlineAt - currentTimeMs())
    const timeoutId = window.setTimeout(() => {
      void dispatch({
        type: 'assassination_timeout',
        actorId: identity.actorId,
      })
    }, delay + 10)

    return () => window.clearTimeout(timeoutId)
  }, [dispatch, identity, state])

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

    if (state.phase === 'lady_of_lake' && state.round.ladyPeekResult) {
      if (state.round.ladyPeekResult.holderId === identity.actorId) {
        void dispatch({
          type: 'lady_acknowledge',
          actorId: identity.actorId,
        })
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
      <main className="mx-auto min-h-dvh max-w-xl bg-[#0d0b08] px-4 py-8 text-[#e8e0d0]">
        <div className="space-y-6">
          <header className="space-y-1 text-center">
            <p className="font-serif text-6xl font-bold uppercase tracking-[0.3em] text-[#8b1f33]">Avalon</p>
            <h1 className="font-serif text-2xl font-black text-[#e8d0a0]">Mobile Round Table Experience</h1>
            <p className="text-lg text-[#8a7050]">
              Play The Hit Party Board Game Anywhere
            </p>
          </header>

          <Section title="Enter Player Name">
            <input
              className="w-full rounded border border-[#2d4a6a]/50 bg-[#e8e0d0] px-3 py-2.5 text-base text-[#1e1408] placeholder:text-[#8a9aaa]"
              placeholder="Your name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Section>

          <Section title="Create Room">
            <button
              className="w-full rounded bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878] disabled:opacity-40"
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
                className="w-full rounded border border-[#2d4a6a]/50 bg-[#e8e0d0] px-3 py-2.5 text-base uppercase text-[#1e1408] placeholder:text-[#8a9aaa]"
                placeholder="Room code"
                value={roomCodeInput}
                onChange={(event) =>
                  setRoomCodeInput(
                    normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_LENGTH),
                  )
                }
              />
              <button
                className="w-full rounded bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878] disabled:opacity-40"
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
                <p className="text-sm text-[#3a4a5a]">
                  Shared room detected: <strong>{deepLinkRoomCode}</strong>
                </p>
              ) : null}
            </div>
          </Section>
        </div>
      </main>
    )
  }

  if (!state || !identity) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl bg-[#0d0b08] px-4 py-8 text-[#e8e0d0]">
        <p className="text-sm text-[#8a7050]">Connecting to room...</p>
      </main>
    )
  }

  const playerCount = state.players.length
  const connectedPlayerCount = state.players.filter((player) => player.connected).length
  const canStart = Boolean(PLAYER_MATRIX[playerCount])
  const canPlayFail =
    myRole?.alignment === 'evil' || state.room.houseRules.allowGoodFail
  const sortedPlayers = [...state.players].sort((a, b) => a.joinOrder - b.joinOrder)
  const teamSizeRequired = PLAYER_MATRIX[state.players.length]
    ? getQuestTeamSize(state.players.length, state.round.questNumber)
    : 0
  const canInteractWithRoundTable = state.phase === 'team_proposal' && isLeader
  const isAssassin = state.assassination?.assassinId === identity.actorId
  const assassinationTargetIds =
    state.phase === 'assassination'
      ? sortedPlayers
          .filter((player) => actorRole(state, player.actorId)?.alignment === 'good')
          .map((player) => player.actorId)
      : []
  const roundTableTeamIds =
    state.phase === 'team_proposal'
      ? teamDraft
      : state.phase === 'assassination' && state.assassination?.suspectId
        ? [state.assassination.suspectId]
        : state.round.proposedTeam
  const teamDraftLimitReached = teamDraft.length >= teamSizeRequired
  const roundTableDisabledIds = canInteractWithRoundTable
    ? sortedPlayers
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
  const revealHighlightIds = myVisibility
    ? [
        ...new Set([
          ...myVisibility.seesEvilIds,
          ...(myRole?.alignment === 'evil' && identity ? [identity.actorId] : []),
        ]),
      ]
    : []
  const roundTableHighlightIds =
    state.phase === 'private_reveal'
      ? revealHighlightIds
      : isRevealOpen
        ? revealHighlightIds
        : []
  const proposalVoteStatusByActorId: Record<string, string> =
    state.phase === 'proposal_vote_reveal'
      ? Object.fromEntries(
          sortedPlayers.map((player) => {
            const vote = state.round.proposalVotes[player.actorId]
            return [
              player.actorId,
              vote === true
                ? 'Approve'
                : vote === false
                  ? 'Reject'
                  : player.connected
                    ? 'Pending'
                    : 'Offline',
            ]
          }),
        )
      : {}
  const proposalVoteToneByActorId: Record<string, 'good' | 'evil'> =
    state.phase === 'proposal_vote_reveal'
      ? sortedPlayers.reduce<Record<string, 'good' | 'evil'>>((acc, player) => {
          const vote = state.round.proposalVotes[player.actorId]
          if (vote === true) acc[player.actorId] = 'good'
          if (vote === false) acc[player.actorId] = 'evil'
          return acc
        }, {})
      : {}
  const endgameRoleLabelByActorId: Record<string, string> =
    state.phase === 'game_end'
      ? Object.fromEntries(
          state.assignments.map((assignment) => [
            assignment.actorId,
            roleLabel(assignment.role),
          ]),
        )
      : {}
  const endgameRoleToneByActorId: Record<string, 'good' | 'evil'> =
    state.phase === 'game_end'
      ? Object.fromEntries(
          state.assignments.map((assignment) => [
            assignment.actorId,
            assignment.alignment,
          ]),
        )
      : {}

  return (
    <main className={`mx-auto min-h-dvh max-w-xl px-4 py-6 ${darkMode ? 'bg-[#0d0b08] text-[#e8d0a0]' : 'bg-[#f5ead0] text-[#1e1408]'}`}>
      <div className="space-y-4">
        <InviteTools
          roomCode={state.room.roomCode}
          variant="floating"
          floatingTopClass="top-[36%]"
          darkMode={darkMode}
          onDarkModeToggle={() => setDarkMode((d) => !d)}
        />

        <RoundTable
          players={sortedPlayers}
          teamIds={roundTableTeamIds}
          leaderId={leaderId}
          highlightIds={roundTableHighlightIds}
          darkMode={darkMode}
          selectableActorIds={
            canInteractWithRoundTable
              ? sortedPlayers.map((p) => p.actorId)
              : state.phase === 'assassination' && isAssassin
                ? assassinationTargetIds
                : []
          }
          disabledActorIds={
            canInteractWithRoundTable
              ? roundTableDisabledIds
              : state.phase === 'assassination' && isAssassin
                ? sortedPlayers
                    .filter((player) => !assassinationTargetIds.includes(player.actorId))
                    .map((player) => player.actorId)
                : []
          }
          selectableHint={
            state.phase === 'assassination' ? 'Tap to Nominate' : 'Tap to Add'
          }
          statusByActorId={
            state.phase === 'proposal_vote_reveal'
              ? proposalVoteStatusByActorId
              : state.phase === 'game_end'
              ? endgameRoleLabelByActorId
              : state.phase === 'assassination' && state.assassination?.suspectId
                ? { [state.assassination.suspectId]: 'Suspect' }
                : {}
          }
          statusToneByActorId={
            state.phase === 'proposal_vote_reveal'
              ? proposalVoteToneByActorId
              : state.phase === 'game_end'
                ? endgameRoleToneByActorId
                : {}
          }
          onPlayerClick={(actorId) => {
            if (canInteractWithRoundTable) {
              setTeamDraft((prev) => {
                if (prev.includes(actorId)) {
                  return prev.filter((id) => id !== actorId)
                }
                if (prev.length >= teamSizeRequired) {
                  return prev
                }
                return [...prev, actorId]
              })
              return
            }

            if (state.phase === 'assassination' && isAssassin) {
              if (!assassinationTargetIds.includes(actorId)) return
              void dispatch({
                type: 'assassination_nominate',
                actorId: identity.actorId,
                suspectId: actorId,
              })
            }
          }}
        />

        {sync.error ? <p className="text-xs text-rose-300">{sync.error}</p> : null}

        {state.phase !== 'lobby' && state.phase !== 'private_reveal' ? (
          <QuestTrack
            outcomes={state.round.questOutcomes}
            currentQuest={state.round.questNumber}
            playerCount={state.players.length}
          />
        ) : null}

        {state.phase !== 'lobby' && state.phase !== 'private_reveal' ? (
          myRole ? (
            <HoldToRevealButton
              roleKey={myRole.role}
              roleLabel={roleLabel(myRole.role)}
              alignmentLabel={myRole.alignment.toUpperCase()}
              power={getRolePowerText(myRole.role)}
              visiblePlayers={visiblePlayerNames}
              open={isRevealOpen}
              onOpenChange={setIsRevealOpen}
              variant="floating"
              floatingTopClass="top-[64%]"
            />
          ) : null
        ) : null}

        {state.phase === 'lobby' ? (
          <Section title="Lobby">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base text-[#1e1408]">
                  {canStart
                    ? `${playerCount} players ready.`
                    : `Need 5–10 players. Current: ${playerCount}`}
                </p>
                <span className="font-serif text-sm font-bold tracking-widest text-[#1a2d4a]">
                  {state.room.roomCode}
                </span>
              </div>

              {state.hostActorId === identity.actorId ? (
                <div className="space-y-3 rounded border border-[#2d4a6a]/40 bg-[#d4ccbe]/20 p-3">
                  <p className="text-sm font-medium text-[#3a4a5a]">Role Toggles</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['mordred', 'Mordred'],
                        ['oberon', 'Oberon'],
                        ['morgana', 'Morgana'],
                        ['percival', 'Percival'],
                        ['ladyOfTheLake', 'Lady of the Lake'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 rounded border border-[#2d4a6a]/30 bg-[#d4ccbe]/30 p-2 text-[#1e1408]">
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
                          className="h-8 w-8 rounded border border-[#2d4a6a]/40 object-cover"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>

                  <label className="block space-y-1.5 text-sm text-[#1e1408]">
                    <span>Assassination Mode</span>
                    <select
                      className="w-full rounded border border-[#2d4a6a]/50 bg-[#e8e0d0] px-3 py-2 text-[#1e1408]"
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

                  <label className="flex items-center gap-2 rounded border border-[#2d4a6a]/30 bg-[#d4ccbe]/30 p-2 text-sm text-[#1e1408]">
                    <input
                      type="checkbox"
                      checked={state.room.houseRules.allowGoodFail}
                      onChange={(event) => {
                        dispatch({
                          type: 'update_house_rules',
                          actorId: identity.actorId,
                          houseRules: { allowGoodFail: event.target.checked },
                        })
                      }}
                    />
                    <span>Allow good players to vote Fail</span>
                  </label>

                  <label className="flex items-center gap-2 rounded border border-[#2d4a6a]/30 bg-[#d4ccbe]/30 p-2 text-sm text-[#1e1408]">
                    <input
                      type="checkbox"
                      checked={state.room.houseRules.hideVotes}
                      onChange={(event) => {
                        dispatch({
                          type: 'update_house_rules',
                          actorId: identity.actorId,
                          houseRules: { hideVotes: event.target.checked },
                        })
                      }}
                    />
                    <span>Hide vote counts until reveal</span>
                  </label>

                  <button
                    className="w-full rounded border border-[#1e3a5a] bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878] disabled:opacity-40"
                    disabled={!canStart}
                    onClick={() => dispatch({ type: 'start_game', actorId: identity.actorId })}
                  >
                    Start Game
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[#3a4a5a]">Host configures roles and starts the game.</p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'private_reveal' && myRole ? (
          <Section title="Private Reveal">
            <div className="space-y-4">
              <div className="space-y-1 text-base text-[#1e1408]">
                <p>Role: <strong>{roleLabel(myRole.role)}</strong></p>
                <p>Team: <strong>{myRole.alignment.toUpperCase()}</strong></p>
              </div>
              {myVisibility ? (
                <div className="rounded border border-[#2d4a6a]/40 bg-[#d4ccbe]/30 p-3 text-sm text-[#1e1408]">
                  {myVisibility.seesEvilIds.length > 0 ? (
                    <p>
                      You see evil:{' '}
                      <strong>{myVisibility.seesEvilIds
                        .map((id) => state.players.find((p) => p.actorId === id)?.displayName ?? id)
                        .join(', ')}</strong>
                    </p>
                  ) : null}
                  {myVisibility.seesMerlinOrMorganaIds.length > 0 ? (
                    <p className="mt-1">
                      Merlin candidates:{' '}
                      <strong>{myVisibility.seesMerlinOrMorganaIds
                        .map((id) => state.players.find((p) => p.actorId === id)?.displayName ?? id)
                        .join(', ')}</strong>
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
                  className="w-full rounded border border-[#1e3a5a] bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878]"
                  onClick={() => dispatch({ type: 'dismiss_reveal', actorId: identity.actorId })}
                >
                  Confirm to Continue
                </button>
              ) : (
                <p className="text-sm text-[#3a4a5a]">
                  Waiting for others to confirm ({state.revealDismissedBy.length}/{connectedPlayerCount})
                </p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'team_proposal' ? (
          <Section title={`Quest ${state.round.questNumber}: Team Proposal (${teamSizeRequired} players)`}>
            <div className="space-y-4">
              <p className="text-base text-[#1e1408]">
                <strong>
                  {state.players.find((p) => p.actorId === leaderId)?.displayName ?? 'Unknown'}
                </strong>{' '}
                is choosing.
              </p>

              {isLeader ? (
                <button
                  className="w-full rounded border border-[#1e3a5a] bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878] disabled:opacity-40"
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
              ) : (
                <p className="text-sm text-[#3a4a5a]">Waiting for leader to propose a team.</p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'proposal_vote' ? (
          <ActionPanel
            title="Cast Your Vote"
            footer={
              !state.room.houseRules.hideVotes ? (
                <p>Votes cast: {Object.keys(state.round.proposalVotes).length} / {connectedPlayerCount}</p>
              ) : undefined
            }
          >
            <p className="mb-4 text-center font-serif text-base text-[#1e1408]">Approve this team?</p>
            {!Object.hasOwn(state.round.proposalVotes, identity.actorId) ? (
              <div className="grid grid-cols-2 gap-3">
                <VoteButton
                  label="Approve"
                  icon="✓"
                  tone="approve"
                  onClick={() =>
                    dispatch({ type: 'cast_proposal_vote', actorId: identity.actorId, approve: true })
                  }
                />
                <VoteButton
                  label="Reject"
                  icon="✕"
                  tone="reject"
                  onClick={() =>
                    dispatch({ type: 'cast_proposal_vote', actorId: identity.actorId, approve: false })
                  }
                />
              </div>
            ) : (
              <p className="text-center text-sm text-[#3a4a5a]">Vote locked. Waiting for all players.</p>
            )}
          </ActionPanel>
        ) : null}

        {state.phase === 'proposal_vote_reveal' ? (
          <div className="space-y-4">
            <TeamResultPanel approved={Boolean(state.round.proposalApproved)} />
            {state.hostActorId === identity.actorId ? (
              <button
                className="w-full rounded border border-[#1e3a5a] bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878]"
                onClick={() =>
                  dispatch({
                    type: 'advance_proposal_vote_reveal',
                    actorId: identity.actorId,
                  })
                }
              >
                Continue
              </button>
            ) : (
              <p className="text-center text-sm text-[#3a4a5a]">Waiting for host to continue.</p>
            )}
          </div>
        ) : null}

        {state.phase === 'quest_vote' ? (
          <ActionPanel
            title="Task Action"
            subtitle="Your card is final. Individual cards remain secret."
            footer={
              !canPlayFail ? (
                <p>Good players cannot play a Fail card.</p>
              ) : !state.room.houseRules.hideVotes ? (
                <p>Cards submitted: {Object.keys(state.round.questVotes).length} / {state.round.proposedTeam.length}</p>
              ) : undefined
            }
          >
            <p className="mb-4 text-center font-serif text-base text-[#1e1408]">Perform Task</p>
            {isQuestMember(state, identity.actorId) ? (
              Object.hasOwn(state.round.questVotes, identity.actorId) ? (
                <p className="text-center text-sm text-[#3a4a5a]">Card submitted. Waiting for others.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <VoteButton
                    label="Pass"
                    icon="✓"
                    tone="success"
                    onClick={() =>
                      dispatch({ type: 'cast_quest_vote', actorId: identity.actorId, card: 'success' })
                    }
                  />
                  <VoteButton
                    label="Fail"
                    icon="✕"
                    tone="fail"
                    disabled={!canPlayFail}
                    onClick={() =>
                      dispatch({ type: 'cast_quest_vote', actorId: identity.actorId, card: 'fail' })
                    }
                  />
                </div>
              )
            ) : (
              <p className="text-center text-sm text-[#3a4a5a]">You are not on this quest team.</p>
            )}
          </ActionPanel>
        ) : null}

        {state.phase === 'quest_vote_reveal' && state.round.questOutcomes.length > 0 ? (
          <div className="space-y-4">
            <QuestResultPanel
              outcome={state.round.questOutcomes[state.round.questOutcomes.length - 1]!}
            />
            {state.hostActorId === identity.actorId ? (
              <button
                className="w-full rounded border border-[#1e3a5a] bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878]"
                onClick={() =>
                  dispatch({
                    type: 'advance_quest_vote_reveal',
                    actorId: identity.actorId,
                  })
                }
              >
                Continue
              </button>
            ) : (
              <p className="text-center text-sm text-[#3a4a5a]">Waiting for host to continue.</p>
            )}
          </div>
        ) : null}

        {state.phase === 'lady_of_lake' ? (
          <Section title="Lady of the Lake">
            <div className="space-y-4">
              <p className="text-base text-[#1e1408]">
                Holder:{' '}
                <strong>
                  {state.players.find((p) => p.actorId === state.round.ladyHolderId)?.displayName ?? 'Unknown'}
                </strong>
              </p>
              {state.round.ladyPeekResult?.holderId === identity.actorId ? (
                <div className="space-y-3 rounded border border-[#2d4a6a]/40 bg-[#d4ccbe]/30 p-3">
                  <p className="text-base text-[#1e1408]">
                    {state.players.find((p) => p.actorId === state.round.ladyPeekResult?.targetId)?.displayName}
                    {' '}is <strong>{state.round.ladyPeekResult.alignment.toUpperCase()}</strong>.
                  </p>
                  <button
                    className="w-full rounded border border-[#1e3a5a] bg-[#1a2d4a] px-4 py-3 font-serif font-bold uppercase tracking-wider text-[#f0d878]"
                    onClick={() => dispatch({ type: 'lady_acknowledge', actorId: identity.actorId })}
                  >
                    Continue
                  </button>
                </div>
              ) : state.round.ladyHolderId === identity.actorId ? (
                <div className="grid grid-cols-2 gap-2">
                  {state.players
                    .filter((p) => !state.round.ladyCheckedIds.includes(p.actorId) && p.actorId !== identity.actorId)
                    .map((player) => (
                      <button
                        key={player.actorId}
                        className="rounded border border-[#2d4a6a]/50 bg-[#d4ccbe]/40 px-2 py-2 text-left text-sm text-[#1a1208] active:bg-[#d4ccbe]/60"
                        onClick={() => dispatch({ type: 'lady_peek', actorId: identity.actorId, targetId: player.actorId })}
                      >
                        Inspect {player.displayName}
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-[#3a4a5a]">
                  {state.round.ladyPeekResult
                    ? 'Waiting for Lady holder to review the result.'
                    : 'Waiting for Lady holder action.'}
                </p>
              )}
            </div>
          </Section>
        ) : null}

        {state.phase === 'assassination' ? (
          <Section title="Assassination Phase">
            <div className="space-y-4">
              <p className="text-base text-[#1e1408]">
                Assassin:{' '}
                <strong>
                  {state.players.find((p) => p.actorId === state.assassination?.assassinId)?.displayName}
                </strong>
              </p>

              {state.assassination?.assassinId === identity.actorId ? (
                <p className="text-sm text-[#3a4a5a]">
                  Tap a good player on the round table to nominate.
                </p>
              ) : null}

              {state.assassination?.suspectId ? (
                <p className="text-base text-[#1e1408]">
                  Suspect:{' '}
                  <strong>
                    {state.players.find((p) => p.actorId === state.assassination?.suspectId)?.displayName}
                  </strong>
                </p>
              ) : (
                <p className="text-sm text-[#3a4a5a]">Waiting for assassin nomination.</p>
              )}

              {state.room.houseRules.assassinationMode === 'evil_confirm_majority_excl_oberon' &&
              state.assassination?.suspectId ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#3a4a5a]">
                    Eligible evil voters (except Oberon): {state.assassination.eligibleVoters.length}
                  </p>
                  {state.assassination.eligibleVoters.includes(identity.actorId) &&
                  !Object.hasOwn(state.assassination.votes, identity.actorId) ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="rounded border-2 border-[#267238] bg-[#1c5226] px-3 py-3 font-serif font-bold uppercase tracking-wide text-white"
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
                        className="rounded border-2 border-[#9a2828] bg-[#7a1a1a] px-3 py-3 font-serif font-bold uppercase tracking-wide text-[#f5d0d0]"
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
                    <p className="text-sm text-[#3a4a5a]">Waiting for evil confirmation votes.</p>
                  )}
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {state.phase === 'game_end' ? (
          <Section title="Game Result">
            <div className="space-y-2">
              <p
                className={`font-serif text-2xl font-black uppercase tracking-wide ${
                  state.winner === 'good' ? 'text-[#1a4a1e]' : 'text-[#6a1010]'
                }`}
              >
                {state.winner === 'good' ? 'Good Wins' : 'Evil Wins'}
              </p>
              <p className="text-sm text-[#3a4a5a]">{state.winningReason}</p>
            </div>
          </Section>
        ) : null}

        {state.phase !== 'lobby' ? (
          <Section title="Rejection Track">
            <RejectionTrack rejectionCount={state.round.rejectionCount} />
          </Section>
        ) : null}
      </div>
    </main>
  )
}

export default App
