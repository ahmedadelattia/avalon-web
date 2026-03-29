export type Alignment = 'good' | 'evil'

export type Role =
  | 'merlin'
  | 'percival'
  | 'loyal_servant'
  | 'assassin'
  | 'morgana'
  | 'mordred'
  | 'oberon'
  | 'minion'

export type GamePhase =
  | 'lobby'
  | 'private_reveal'
  | 'team_proposal'
  | 'proposal_vote'
  | 'quest_vote'
  | 'lady_of_lake'
  | 'assassination'
  | 'game_end'

export type AssassinationRuleMode =
  | 'official'
  | 'evil_confirm_majority_excl_oberon'

export interface EnabledRoles {
  mordred: boolean
  oberon: boolean
  morgana: boolean
  percival: boolean
  ladyOfTheLake: boolean
}

export interface HouseRules {
  assassinationMode: AssassinationRuleMode
  assassinationConfirmTimeoutMs: number
  allowGoodFail: boolean
}

export interface RoomConfig {
  roomCode: string
  enabledRoles: EnabledRoles
  houseRules: HouseRules
}

export interface PlayerIdentity {
  actorId: string
  deviceId: string
  displayName: string
}

export interface PlayerPresence {
  actorId: string
  displayName: string
  joinOrder: number
  connected: boolean
  isHost: boolean
  lastSeenAt: number
}

export interface RoleAssignment {
  actorId: string
  role: Role
  alignment: Alignment
}

export interface QuestOutcome {
  questNumber: number
  team: string[]
  failCount: number
  success: boolean
}

export interface VoteTally {
  confirm: number
  reject: number
}

export interface AssassinationState {
  assassinId: string
  suspectId: string | null
  eligibleVoters: string[]
  votes: Record<string, 'confirm' | 'reject'>
  deadlineAt: number
}

export interface VisibilityModel {
  byActorId: Record<
    string,
    {
      seesEvilIds: string[]
      seesMerlinOrMorganaIds: string[]
      role: Role
      alignment: Alignment
    }
  >
}

export interface RoundState {
  questNumber: number
  leaderOrder: number
  rejectionCount: number
  proposedTeam: string[]
  proposalVotes: Record<string, boolean>
  questVotes: Record<string, 'success' | 'fail'>
  questOutcomes: QuestOutcome[]
  ladyHolderId: string | null
  ladyCheckedIds: string[]
  ladyPeekTargetId: string | null
}

export interface GameState {
  room: RoomConfig
  phase: GamePhase
  hostActorId: string
  hostEpoch: number
  seq: number
  players: PlayerPresence[]
  assignments: RoleAssignment[]
  visibility: VisibilityModel | null
  revealDismissedBy: string[]
  round: RoundState
  assassination: AssassinationState | null
  winner: Alignment | null
  winningReason: string | null
  createdAt: number
  updatedAt: number
}

export interface ClientIntent<T = unknown> {
  actionId: string
  roomCode: string
  actorId: string
  phase: GamePhase
  payload: T
  sentAt: number
}

export interface HostCommit {
  seq: number
  actionId: string
  roomCode: string
  actorId: string
  stateHash: string
  stateSnapshotDelta: GameState
  committedAt: number
  hostEpoch: number
}

export interface SystemEvent {
  type: 'host_migrated' | 'presence_changed' | 'resync_requested'
  roomCode: string
  holderId: string
  sentAt: number
  hostEpoch: number
}

export type EngineAction =
  | { type: 'player_join'; actorId: string; displayName: string; now: number }
  | { type: 'player_connection'; actorId: string; connected: boolean; now: number }
  | { type: 'set_host'; actorId: string; hostEpoch: number; now: number }
  | { type: 'update_roles'; actorId: string; enabledRoles: EnabledRoles; now: number }
  | {
      type: 'update_house_rules'
      actorId: string
      houseRules: Partial<HouseRules>
      now: number
    }
  | { type: 'start_game'; actorId: string; now: number }
  | { type: 'dismiss_reveal'; actorId: string; now: number }
  | { type: 'propose_team'; actorId: string; team: string[]; now: number }
  | { type: 'cast_proposal_vote'; actorId: string; approve: boolean; now: number }
  | {
      type: 'cast_quest_vote'
      actorId: string
      card: 'success' | 'fail'
      now: number
    }
  | { type: 'lady_peek'; actorId: string; targetId: string; now: number }
  | {
      type: 'assassination_nominate'
      actorId: string
      suspectId: string
      now: number
    }
  | {
      type: 'assassination_confirm_vote'
      actorId: string
      vote: 'confirm' | 'reject'
      now: number
    }
  | { type: 'assassination_timeout'; actorId: string; now: number }

export interface RolePowerText {
  short: string
  detail: string
}
