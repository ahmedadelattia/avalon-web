import {
  assignRoles,
  buildVisibility,
  DEFAULT_ENABLED_ROLES,
  firstLeaderOrder,
  getQuestTeamSize,
  PLAYER_MATRIX,
  requiresTwoFails,
} from './rules'
import { SOLO_TEST_ROOM_CODE } from './room'
import type {
  Alignment,
  EngineAction,
  GameState,
  HouseRules,
  PlayerPresence,
  Role,
  RoleAssignment,
} from './types'

export const DEFAULT_HOUSE_RULES: HouseRules = {
  assassinationMode: 'evil_confirm_majority_excl_oberon',
  assassinationConfirmTimeoutMs: 30000,
  allowGoodFail: true,
  hideVotes: false,
}

function nowSafe(now?: number): number {
  return now ?? Date.now()
}

export function createInitialState(roomCode: string, hostIdentity: {
  actorId: string
  displayName: string
}, now = Date.now()): GameState {
  const player: PlayerPresence = {
    actorId: hostIdentity.actorId,
    displayName: hostIdentity.displayName,
    joinOrder: 0,
    connected: true,
    isHost: true,
    lastSeenAt: now,
  }

  return {
    room: {
      roomCode,
      enabledRoles: { ...DEFAULT_ENABLED_ROLES },
      houseRules: { ...DEFAULT_HOUSE_RULES },
    },
    phase: 'lobby',
    hostActorId: hostIdentity.actorId,
    hostEpoch: 1,
    seq: 0,
    players: [player],
    assignments: [],
    visibility: null,
    revealDismissedBy: [],
    round: {
      questNumber: 1,
      leaderOrder: 0,
      rejectionCount: 0,
      proposedTeam: [],
      proposalVotes: {},
      proposalApproved: null,
      questVotes: {},
      questOutcomes: [],
      ladyHolderId: null,
      ladyCheckedIds: [],
      ladyPeekTargetId: null,
      ladyPeekResult: null,
    },
    assassination: null,
    winner: null,
    winningReason: null,
    createdAt: now,
    updatedAt: now,
  }
}

function cloneState(state: GameState): GameState {
  return structuredClone(state)
}

function sortedPlayers(state: GameState): PlayerPresence[] {
  return [...state.players].sort((a, b) => a.joinOrder - b.joinOrder)
}

function connectedPlayers(state: GameState): PlayerPresence[] {
  return sortedPlayers(state).filter((player) => player.connected)
}

function assignmentByActor(assignments: RoleAssignment[], actorId: string) {
  return assignments.find((a) => a.actorId === actorId)
}

function goodSuccesses(state: GameState): number {
  return state.round.questOutcomes.filter((q) => q.success).length
}

function evilSuccesses(state: GameState): number {
  return state.round.questOutcomes.filter((q) => !q.success).length
}

function setWinner(state: GameState, winner: Alignment, reason: string) {
  state.winner = winner
  state.winningReason = reason
  state.phase = 'game_end'
}

function isActorHost(state: GameState, actorId: string): boolean {
  return state.hostActorId === actorId
}

function ensureHost(state: GameState, actorId: string) {
  if (!isActorHost(state, actorId)) {
    throw new Error('Only host can perform this action')
  }
}

function ensureLobby(state: GameState) {
  if (state.phase !== 'lobby') {
    throw new Error('Action only allowed in lobby')
  }
}

function eligibleAssassinationVoters(state: GameState): string[] {
  return state.assignments
    .filter((a) => {
      if (a.alignment !== 'evil') return false
      if (a.role === 'oberon') return false
      const player = state.players.find((p) => p.actorId === a.actorId)
      return Boolean(player?.connected)
    })
    .map((a) => a.actorId)
}

function prepareQuestRoundForPhase(state: GameState) {
  state.round.proposedTeam = []
  state.round.proposalVotes = {}
  state.round.proposalApproved = null
  state.round.questVotes = {}
  state.round.ladyPeekTargetId = null
  state.round.ladyPeekResult = null
  state.phase = 'team_proposal'
}

function nextLeader(state: GameState) {
  const players = sortedPlayers(state)
  if (players.length === 0) return
  if (state.room.roomCode === SOLO_TEST_ROOM_CODE) {
    const hostIndex = players.findIndex((p) => p.actorId === state.hostActorId)
    state.round.leaderOrder = hostIndex >= 0 ? hostIndex : 0
    return
  }
  state.round.leaderOrder = (state.round.leaderOrder + 1) % players.length
}

function ensureTeamSize(state: GameState, teamIds: string[]) {
  const required = getQuestTeamSize(state.players.length, state.round.questNumber)
  if (teamIds.length !== required) {
    throw new Error(`Team must contain ${required} players`)
  }
}

function finalizeQuestIfReady(state: GameState) {
  if (state.phase !== 'quest_vote') return
  if (state.round.proposedTeam.length === 0) return
  if (
    state.round.proposedTeam.some((actorId) => {
      const player = state.players.find((candidate) => candidate.actorId === actorId)
      return !player?.connected
    })
  ) {
    prepareQuestRoundForPhase(state)
    return
  }
  if (Object.keys(state.round.questVotes).length !== state.round.proposedTeam.length) {
    return
  }

  const votes = Object.values(state.round.questVotes)
  const failCount = votes.filter((v) => v === 'fail').length
  const success = requiresTwoFails(state.players.length, state.round.questNumber)
    ? failCount < 2
    : failCount < 1

  state.round.questOutcomes.push({
    questNumber: state.round.questNumber,
    team: [...state.round.proposedTeam],
    failCount,
    success,
  })

  // Keep proposedTeam and questVotes so the reveal phase can display who was on the quest
  state.phase = 'quest_vote_reveal'
}

function advanceQuestVoteReveal(state: GameState, now: number) {
  if (state.phase !== 'quest_vote_reveal') return

  state.round.proposedTeam = []
  state.round.proposalVotes = {}
  state.round.questVotes = {}
  state.round.rejectionCount = 0
  nextLeader(state)

  if (evilSuccesses(state) >= 3) {
    setWinner(state, 'evil', 'Evil completed 3 failed quests')
    return
  }

  if (goodSuccesses(state) >= 3) {
    const assassin = state.assignments.find((a) => a.role === 'assassin')
    if (!assassin) {
      setWinner(state, 'good', 'Good completed 3 successful quests')
      return
    }

    state.phase = 'assassination'
    state.assassination = {
      assassinId: assassin.actorId,
      suspectId: null,
      eligibleVoters: eligibleAssassinationVoters(state),
      votes: {},
      deadlineAt: now + state.room.houseRules.assassinationConfirmTimeoutMs,
    }
    return
  }

  state.round.questNumber += 1

  if (
    state.room.enabledRoles.ladyOfTheLake &&
    state.round.questNumber >= 3 &&
    state.round.questNumber <= 5
  ) {
    state.phase = 'lady_of_lake'
    if (!state.round.ladyHolderId) {
      state.round.ladyHolderId = sortedPlayers(state)[0]?.actorId ?? null
      if (state.round.ladyHolderId) {
        state.round.ladyCheckedIds = [state.round.ladyHolderId]
      }
    }
    return
  }

  prepareQuestRoundForPhase(state)
}

function finalizeProposalIfReady(state: GameState) {
  if (state.phase !== 'proposal_vote') return
  const voters = connectedPlayers(state)
  const connectedVoterIds = new Set(voters.map((player) => player.actorId))
  state.round.proposalVotes = Object.fromEntries(
    Object.entries(state.round.proposalVotes).filter(([actorId]) => connectedVoterIds.has(actorId)),
  )
  if (Object.keys(state.round.proposalVotes).length !== voters.length) {
    return
  }

  const approvals = Object.values(state.round.proposalVotes).filter(Boolean).length
  state.round.proposalApproved = approvals > voters.length / 2
  state.phase = 'proposal_vote_reveal'
}

function advanceProposalVoteReveal(state: GameState) {
  if (state.phase !== 'proposal_vote_reveal') return

  if (state.round.proposalApproved) {
    state.phase = 'quest_vote'
    state.round.proposalVotes = {}
    state.round.questVotes = {}
    return
  }

  state.round.rejectionCount += 1
  state.round.proposedTeam = []
  state.round.proposalVotes = {}
  state.round.proposalApproved = null
  nextLeader(state)

  if (state.round.rejectionCount >= 5) {
    setWinner(state, 'evil', 'Five consecutive rejected teams')
    return
  }

  state.phase = 'team_proposal'
}

function nominateAssassination(state: GameState, actorId: string, suspectId: string, now: number) {
  if (state.phase !== 'assassination' || !state.assassination) {
    throw new Error('Not in assassination phase')
  }
  if (state.assassination.assassinId !== actorId) {
    throw new Error('Only assassin can nominate')
  }

  state.assassination.suspectId = suspectId

  if (state.room.houseRules.assassinationMode === 'official') {
    const target = assignmentByActor(state.assignments, suspectId)
    if (target?.role === 'merlin') {
      setWinner(state, 'evil', 'Assassin found Merlin')
    } else {
      setWinner(state, 'good', 'Assassin missed Merlin')
    }
    return
  }

  state.assassination.deadlineAt = now + state.room.houseRules.assassinationConfirmTimeoutMs
}

function finalizeAssassinationConfirmation(state: GameState) {
  const assn = state.assassination
  if (!assn || state.phase !== 'assassination') return
  if (!assn.suspectId) return

  const tally = assn.eligibleVoters.reduce(
    (acc, voterId) => {
      const vote = assn.votes[voterId]
      if (vote === 'confirm') acc.confirm += 1
      else acc.reject += 1
      return acc
    },
    { confirm: 0, reject: 0 },
  )

  const passed = tally.confirm > tally.reject
  if (!passed) {
    setWinner(state, 'good', 'Evil confirmation vote failed')
    return
  }

  const target = assignmentByActor(state.assignments, assn.suspectId)
  if (target?.role === 'merlin') {
    setWinner(state, 'evil', 'Evil confirmed Merlin assassination')
  } else {
    setWinner(state, 'good', 'Assassination target was not Merlin')
  }
}

function maybeMigrateHost(state: GameState, now: number) {
  const currentHost = state.players.find((p) => p.actorId === state.hostActorId)
  if (currentHost?.connected) return

  const candidate = sortedPlayers(state).find((p) => p.connected)
  if (!candidate) return

  state.hostActorId = candidate.actorId
  state.hostEpoch += 1
  for (const player of state.players) {
    player.isHost = player.actorId === candidate.actorId
    player.lastSeenAt = now
  }
}

export function reduceGameState(state: GameState, action: EngineAction): GameState {
  const next = cloneState(state)
  const now = nowSafe(action.now)

  switch (action.type) {
    case 'player_join': {
      ensureLobby(next)
      const existing = next.players.find((p) => p.actorId === action.actorId)
      if (existing) {
        existing.connected = true
        existing.displayName = action.displayName
        existing.lastSeenAt = now
        break
      }
      const nameTaken = new Set(next.players.map((p) => p.displayName.toLowerCase()))
      let displayName = action.displayName.trim() || 'Player'
      let suffix = 2
      while (nameTaken.has(displayName.toLowerCase())) {
        displayName = `${action.displayName} (${suffix})`
        suffix += 1
      }

      next.players.push({
        actorId: action.actorId,
        displayName,
        joinOrder: next.players.length,
        connected: true,
        isHost: false,
        lastSeenAt: now,
      })
      break
    }

    case 'player_connection': {
      const player = next.players.find((p) => p.actorId === action.actorId)
      if (!player) break
      player.connected = action.connected
      player.lastSeenAt = now
      if (next.phase === 'private_reveal') {
        const connectedActorIds = new Set(connectedPlayers(next).map((entry) => entry.actorId))
        next.revealDismissedBy = next.revealDismissedBy.filter((actorId) => connectedActorIds.has(actorId))
        if (next.revealDismissedBy.length === connectedActorIds.size) {
          next.phase = 'team_proposal'
        }
      }
      if (next.phase === 'proposal_vote') {
        finalizeProposalIfReady(next)
      }
      if (next.phase === 'quest_vote') {
        finalizeQuestIfReady(next)
      }
      maybeMigrateHost(next, now)
      break
    }

    case 'set_host': {
      const candidate = next.players.find((p) => p.actorId === action.actorId)
      if (!candidate) break
      next.hostActorId = action.actorId
      next.hostEpoch = Math.max(next.hostEpoch + 1, action.hostEpoch)
      for (const player of next.players) {
        player.isHost = player.actorId === action.actorId
      }
      break
    }

    case 'update_roles': {
      ensureHost(next, action.actorId)
      ensureLobby(next)
      next.room.enabledRoles = { ...action.enabledRoles }
      break
    }

    case 'update_house_rules': {
      ensureHost(next, action.actorId)
      ensureLobby(next)
      next.room.houseRules = {
        ...next.room.houseRules,
        ...action.houseRules,
      }
      break
    }

    case 'start_game': {
      ensureHost(next, action.actorId)
      ensureLobby(next)
      const playerCount = next.players.length
      if (!PLAYER_MATRIX[playerCount]) {
        throw new Error('Avalon requires 5-10 players')
      }

      const players = sortedPlayers(next)
      next.assignments = assignRoles(
        players.map((p) => p.actorId),
        next.room.enabledRoles,
      )
      next.visibility = buildVisibility(next.assignments)
      next.phase = 'private_reveal'
      next.revealDismissedBy = []
      if (next.room.roomCode === SOLO_TEST_ROOM_CODE) {
        const hostIndex = players.findIndex((p) => p.actorId === next.hostActorId)
        next.round.leaderOrder = hostIndex >= 0 ? hostIndex : 0
      } else {
        next.round.leaderOrder = firstLeaderOrder(players.length)
      }
      next.round.questNumber = 1
      next.round.rejectionCount = 0
      next.round.proposedTeam = []
      next.round.proposalVotes = {}
      next.round.proposalApproved = null
      next.round.questVotes = {}
      next.round.questOutcomes = []
      next.round.ladyHolderId =
        next.room.enabledRoles.ladyOfTheLake && players[0]
          ? players[0].actorId
          : null
      next.round.ladyCheckedIds = next.round.ladyHolderId
        ? [next.round.ladyHolderId]
        : []
      next.round.ladyPeekTargetId = null
      next.round.ladyPeekResult = null
      next.assassination = null
      next.winner = null
      next.winningReason = null
      break
    }

    case 'dismiss_reveal': {
      if (next.phase !== 'private_reveal') {
        throw new Error('Not in private reveal phase')
      }
      if (!next.revealDismissedBy.includes(action.actorId)) {
        next.revealDismissedBy.push(action.actorId)
      }
      const connectedActorIds = new Set(connectedPlayers(next).map((player) => player.actorId))
      next.revealDismissedBy = next.revealDismissedBy.filter((actorId) => connectedActorIds.has(actorId))
      if (next.revealDismissedBy.length === connectedActorIds.size) {
        next.phase = 'team_proposal'
      }
      break
    }

    case 'propose_team': {
      if (next.phase !== 'team_proposal') {
        throw new Error('Not in team proposal phase')
      }
      const players = sortedPlayers(next)
      const leader = players[next.round.leaderOrder]
      if (leader?.actorId !== action.actorId) {
        throw new Error('Only leader can propose team')
      }
      const unique = [...new Set(action.team)]
      ensureTeamSize(next, unique)
      next.round.proposedTeam = unique
      next.round.proposalVotes = {}
      next.round.proposalApproved = null
      next.phase = 'proposal_vote'
      break
    }

    case 'cast_proposal_vote': {
      if (next.phase !== 'proposal_vote') {
        throw new Error('Not in proposal voting phase')
      }
      next.round.proposalVotes[action.actorId] = action.approve
      finalizeProposalIfReady(next)
      break
    }

    case 'advance_proposal_vote_reveal': {
      if (next.phase !== 'proposal_vote_reveal') {
        throw new Error('Not in proposal vote reveal phase')
      }
      ensureHost(next, action.actorId)
      advanceProposalVoteReveal(next)
      break
    }

    case 'cast_quest_vote': {
      if (next.phase !== 'quest_vote') {
        throw new Error('Not in quest voting phase')
      }
      if (!next.round.proposedTeam.includes(action.actorId)) {
        throw new Error('Only quest members may vote')
      }
      if (action.card === 'fail') {
        const isEvil = assignmentByActor(next.assignments, action.actorId)?.alignment === 'evil'
        if (!isEvil && !next.room.houseRules.allowGoodFail) {
          throw new Error('Good players cannot submit fail')
        }
      }
      next.round.questVotes[action.actorId] = action.card
      finalizeQuestIfReady(next)
      break
    }

    case 'advance_quest_vote_reveal': {
      if (next.phase !== 'quest_vote_reveal') {
        throw new Error('Not in quest vote reveal phase')
      }
      ensureHost(next, action.actorId)
      advanceQuestVoteReveal(next, now)
      break
    }

    case 'lady_peek': {
      if (next.phase !== 'lady_of_lake') {
        throw new Error('Not in Lady of the Lake phase')
      }
      if (next.round.ladyHolderId !== action.actorId) {
        throw new Error('Only Lady holder can inspect')
      }
      if (next.round.ladyCheckedIds.includes(action.targetId)) {
        throw new Error('Cannot inspect someone who already held Lady')
      }
      const target = assignmentByActor(next.assignments, action.targetId)
      next.round.ladyPeekTargetId = action.targetId
      next.round.ladyPeekResult = {
        holderId: action.actorId,
        targetId: action.targetId,
        alignment: target?.alignment ?? 'good',
      }
      next.round.ladyHolderId = action.targetId
      next.round.ladyCheckedIds.push(action.targetId)
      break
    }

    case 'lady_acknowledge': {
      if (next.phase !== 'lady_of_lake') {
        throw new Error('Not in Lady of the Lake phase')
      }
      if (next.round.ladyPeekResult?.holderId !== action.actorId) {
        throw new Error('Only Lady holder can acknowledge result')
      }
      next.round.ladyPeekResult = null
      prepareQuestRoundForPhase(next)
      break
    }

    case 'assassination_nominate': {
      nominateAssassination(next, action.actorId, action.suspectId, now)
      break
    }

    case 'assassination_confirm_vote': {
      const assn = next.assassination
      if (next.phase !== 'assassination' || !assn) {
        throw new Error('Not in assassination phase')
      }
      if (next.room.houseRules.assassinationMode === 'official') {
        throw new Error('Confirmation vote not used in official mode')
      }
      if (!assn.suspectId) {
        throw new Error('Assassin must nominate first')
      }
      if (!assn.eligibleVoters.includes(action.actorId)) {
        throw new Error('Actor is not an eligible confirmer')
      }
      assn.votes[action.actorId] = action.vote
      if (Object.keys(assn.votes).length === assn.eligibleVoters.length) {
        finalizeAssassinationConfirmation(next)
      }
      break
    }

    case 'assassination_timeout': {
      const assn = next.assassination
      if (next.phase !== 'assassination' || !assn) {
        throw new Error('Not in assassination phase')
      }
      if (now < assn.deadlineAt) {
        throw new Error('Assassination timer not expired')
      }
      finalizeAssassinationConfirmation(next)
      break
    }

    default:
      break
  }

  maybeMigrateHost(next, now)
  next.updatedAt = now
  return next
}

export function roleLabel(role: Role): string {
  return role
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

export function actorRole(state: GameState, actorId: string): RoleAssignment | undefined {
  return state.assignments.find((a) => a.actorId === actorId)
}

export function actorAlignment(state: GameState, actorId: string): Alignment | undefined {
  return actorRole(state, actorId)?.alignment
}

export function leaderActorId(state: GameState): string | null {
  const players = sortedPlayers(state)
  return players[state.round.leaderOrder]?.actorId ?? null
}

export function isQuestMember(state: GameState, actorId: string): boolean {
  return state.round.proposedTeam.includes(actorId)
}
