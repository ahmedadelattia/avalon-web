import { describe, expect, it } from 'vitest'
import type { RoleAssignment } from '../lib/types'
import {
  buildRoleDeck,
  buildVisibility,
  getQuestTeamSize,
  PLAYER_MATRIX,
  requiresTwoFails,
} from '../lib/rules'

describe('rules matrix', () => {
  it('has entries for 5-10 players', () => {
    expect(Object.keys(PLAYER_MATRIX).map(Number)).toEqual([5, 6, 7, 8, 9, 10])
  })

  it('returns quest team sizes correctly', () => {
    expect(getQuestTeamSize(5, 1)).toBe(2)
    expect(getQuestTeamSize(10, 4)).toBe(5)
  })

  it('applies two-fail rule only on quest 4 with 7+ players', () => {
    expect(requiresTwoFails(7, 4)).toBe(true)
    expect(requiresTwoFails(6, 4)).toBe(false)
    expect(requiresTwoFails(8, 3)).toBe(false)
  })

  it('builds role deck with required counts', () => {
    const deck = buildRoleDeck(7, {
      mordred: true,
      oberon: false,
      morgana: true,
      percival: true,
      ladyOfTheLake: true,
    })

    expect(deck.length).toBe(7)
    expect(deck).toContain('merlin')
    expect(deck).toContain('assassin')
    expect(deck).toContain('mordred')
    expect(deck).toContain('morgana')
    expect(deck).toContain('percival')
  })
})

describe('visibility', () => {
  it('keeps oberon hidden from evil team and merlin', () => {
    const assignments: RoleAssignment[] = [
      { actorId: 'a', role: 'assassin', alignment: 'evil' },
      { actorId: 'b', role: 'oberon', alignment: 'evil' },
      { actorId: 'c', role: 'merlin', alignment: 'good' },
      { actorId: 'd', role: 'loyal_servant', alignment: 'good' },
      { actorId: 'e', role: 'loyal_servant', alignment: 'good' },
    ]

    const visibility = buildVisibility(assignments)
    expect(visibility.byActorId.a.seesEvilIds).not.toContain('b')
    expect(visibility.byActorId.c.seesEvilIds).not.toContain('b')
  })
})
