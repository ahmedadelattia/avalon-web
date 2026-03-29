import type {
  Alignment,
  EnabledRoles,
  Role,
  RoleAssignment,
  RolePowerText,
  VisibilityModel,
} from './types'

export const DEFAULT_ENABLED_ROLES: EnabledRoles = {
  mordred: false,
  oberon: false,
  morgana: false,
  percival: false,
  ladyOfTheLake: false,
}

export const PLAYER_MATRIX: Record<
  number,
  {
    good: number
    evil: number
    teamSizes: [number, number, number, number, number]
  }
> = {
  5: { good: 3, evil: 2, teamSizes: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, teamSizes: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, teamSizes: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, teamSizes: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, teamSizes: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, teamSizes: [3, 4, 4, 5, 5] },
}

export function getQuestTeamSize(playerCount: number, questNumber: number): number {
  const matrix = PLAYER_MATRIX[playerCount]
  if (!matrix || questNumber < 1 || questNumber > 5) {
    throw new Error('Invalid player count or quest number')
  }
  return matrix.teamSizes[questNumber - 1]
}

export function requiresTwoFails(playerCount: number, questNumber: number): boolean {
  return playerCount >= 7 && questNumber === 4
}

function roleAlignment(role: Role): Alignment {
  switch (role) {
    case 'assassin':
    case 'morgana':
    case 'mordred':
    case 'oberon':
    case 'minion':
      return 'evil'
    default:
      return 'good'
  }
}

export function getRolePowerText(role: Role): RolePowerText {
  switch (role) {
    case 'merlin':
      return {
        short: 'Sees evil, except Mordred and Oberon.',
        detail:
          'At game start, you know evil players except Mordred and Oberon. Stay hidden from Assassin.',
      }
    case 'percival':
      return {
        short: 'Sees Merlin (and Morgana if enabled).',
        detail:
          'You see Merlin and Morgana as possible Merlin targets. You cannot tell which is real Merlin.',
      }
    case 'mordred':
      return {
        short: 'Hidden from Merlin.',
        detail: 'You are evil and stay invisible to Merlin at setup.',
      }
    case 'oberon':
      return {
        short: 'Evil, but isolated.',
        detail: 'You do not know evil teammates, and they do not know you.',
      }
    case 'morgana':
      return {
        short: 'Appears as Merlin to Percival.',
        detail: 'You are evil and create uncertainty for Percival.',
      }
    case 'assassin':
      return {
        short: 'Can attempt to kill Merlin after good reaches 3 successes.',
        detail: 'In assassination phase, choose a suspect to steal victory for evil.',
      }
    case 'minion':
      return {
        short: 'Standard evil role.',
        detail: 'Work with evil team to fail quests and mislead good.',
      }
    case 'loyal_servant':
      return {
        short: 'Standard good role.',
        detail: 'Support good by inferring evil from proposals and votes.',
      }
  }
}

export function buildRoleDeck(playerCount: number, enabled: EnabledRoles): Role[] {
  const matrix = PLAYER_MATRIX[playerCount]
  if (!matrix) {
    throw new Error('Avalon supports 5-10 players')
  }

  const goodRoles: Role[] = ['merlin']
  const evilRoles: Role[] = ['assassin']

  if (enabled.percival) goodRoles.push('percival')
  if (enabled.mordred) evilRoles.push('mordred')
  if (enabled.oberon) evilRoles.push('oberon')
  if (enabled.morgana) evilRoles.push('morgana')

  while (goodRoles.length < matrix.good) goodRoles.push('loyal_servant')
  while (evilRoles.length < matrix.evil) evilRoles.push('minion')

  if (goodRoles.length > matrix.good || evilRoles.length > matrix.evil) {
    throw new Error('Too many optional roles for this player count')
  }

  return [...goodRoles, ...evilRoles]
}

export function shuffleWithCrypto<T>(arr: T[]): T[] {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    const j = Math.floor(rand * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function assignRoles(playerIds: string[], enabled: EnabledRoles): RoleAssignment[] {
  const deck = shuffleWithCrypto(buildRoleDeck(playerIds.length, enabled))
  return playerIds.map((actorId, index) => {
    const role = deck[index]
    return {
      actorId,
      role,
      alignment: roleAlignment(role),
    }
  })
}

export function buildVisibility(assignments: RoleAssignment[]): VisibilityModel {
  const roleByActor = new Map(assignments.map((a) => [a.actorId, a]))
  const evilVisibleToEvil = assignments
    .filter((a) => a.alignment === 'evil' && a.role !== 'oberon')
    .map((a) => a.actorId)

  const merlinVisibleEvil = assignments
    .filter(
      (a) =>
        a.alignment === 'evil' &&
        a.role !== 'mordred' &&
        a.role !== 'oberon',
    )
    .map((a) => a.actorId)

  const merlinActorId = assignments.find((a) => a.role === 'merlin')?.actorId
  const morganaActorId = assignments.find((a) => a.role === 'morgana')?.actorId

  const byActorId: VisibilityModel['byActorId'] = {}

  for (const a of assignments) {
    const base = {
      seesEvilIds: [] as string[],
      seesMerlinOrMorganaIds: [] as string[],
      role: a.role,
      alignment: a.alignment,
    }

    if (a.alignment === 'evil' && a.role !== 'oberon') {
      base.seesEvilIds = evilVisibleToEvil.filter((id) => id !== a.actorId)
    }

    if (a.role === 'merlin') {
      base.seesEvilIds = merlinVisibleEvil
    }

    if (a.role === 'percival') {
      const ids = [merlinActorId, morganaActorId].filter(
        (id): id is string => Boolean(id),
      )
      base.seesMerlinOrMorganaIds = shuffleWithCrypto(ids)
    }

    byActorId[a.actorId] = base
  }

  for (const actorId of roleByActor.keys()) {
    if (!byActorId[actorId]) {
      const entry = roleByActor.get(actorId)
      if (!entry) continue
      byActorId[actorId] = {
        seesEvilIds: [],
        seesMerlinOrMorganaIds: [],
        role: entry.role,
        alignment: entry.alignment,
      }
    }
  }

  return { byActorId }
}

export function firstLeaderOrder(playerCount: number): number {
  return Math.floor(
    (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * playerCount,
  )
}
