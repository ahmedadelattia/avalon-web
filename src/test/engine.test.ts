import { describe, expect, it } from 'vitest'
import { createInitialState, reduceGameState } from '../lib/engine'
import type { EngineAction, GameState } from '../lib/types'

type WithoutNow<T> = T extends { now: number } ? Omit<T, 'now'> : never
type EngineActionInput = WithoutNow<EngineAction>

function run(state: GameState, action: EngineActionInput) {
  return reduceGameState(state, { ...action, now: Date.now() } as EngineAction)
}

function setupFivePlayers() {
  let state = createInitialState('ROOMAA', {
    actorId: 'p1',
    displayName: 'P1',
  })

  state = run(state, { type: 'player_join', actorId: 'p2', displayName: 'P2' })
  state = run(state, { type: 'player_join', actorId: 'p3', displayName: 'P3' })
  state = run(state, { type: 'player_join', actorId: 'p4', displayName: 'P4' })
  state = run(state, { type: 'player_join', actorId: 'p5', displayName: 'P5' })

  return state
}

describe('engine', () => {
  it('reject tie counts as rejection and 5 rejections gives evil win', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })

    for (const p of state.players) {
      state = run(state, { type: 'dismiss_reveal', actorId: p.actorId })
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const leader = state.players[state.round.leaderOrder].actorId
      state = run(state, {
        type: 'propose_team',
        actorId: leader,
        team: state.players.slice(0, 2).map((p) => p.actorId),
      })

      const votes = [true, true, false, false, false]
      state.players.forEach((player, index) => {
        state = run(state, {
          type: 'cast_proposal_vote',
          actorId: player.actorId,
          approve: votes[index],
        })
      })
    }

    expect(state.phase).toBe('game_end')
    expect(state.winner).toBe('evil')
    expect(state.winningReason).toContain('Five consecutive rejected teams')
  })

  it('allows good player to submit fail card by default', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })

    for (const p of state.players) {
      state = run(state, { type: 'dismiss_reveal', actorId: p.actorId })
    }

    const leader = state.players[state.round.leaderOrder].actorId
    const team = state.players.slice(0, 2).map((p) => p.actorId)
    state = run(state, {
      type: 'propose_team',
      actorId: leader,
      team,
    })

    for (const p of state.players) {
      state = run(state, {
        type: 'cast_proposal_vote',
        actorId: p.actorId,
        approve: true,
      })
    }

    const goodQuestPlayer = team.find(
      (id) => state.assignments.find((a) => a.actorId === id)?.alignment === 'good',
    )

    if (!goodQuestPlayer) return

    state = run(state, {
      type: 'cast_quest_vote',
      actorId: goodQuestPlayer,
      card: 'fail',
    })
    expect(state.round.questVotes[goodQuestPlayer]).toBe('fail')
  })

  it('blocks good fail vote when disabled in house rules', () => {
    let state = setupFivePlayers()
    state = run(state, {
      type: 'update_house_rules',
      actorId: 'p1',
      houseRules: { allowGoodFail: false },
    })
    state = run(state, { type: 'start_game', actorId: 'p1' })

    for (const p of state.players) {
      state = run(state, { type: 'dismiss_reveal', actorId: p.actorId })
    }

    const leader = state.players[state.round.leaderOrder].actorId
    const team = state.players.slice(0, 2).map((p) => p.actorId)
    state = run(state, {
      type: 'propose_team',
      actorId: leader,
      team,
    })

    for (const p of state.players) {
      state = run(state, {
        type: 'cast_proposal_vote',
        actorId: p.actorId,
        approve: true,
      })
    }

    const goodQuestPlayer = team.find(
      (id) => state.assignments.find((a) => a.actorId === id)?.alignment === 'good',
    )

    if (!goodQuestPlayer) return

    expect(() =>
      run(state, {
        type: 'cast_quest_vote',
        actorId: goodQuestPlayer,
        card: 'fail',
      }),
    ).toThrow('Good players cannot submit fail')
  })

  it('official assassination mode resolves immediately', () => {
    let state = setupFivePlayers()
    state = run(state, {
      type: 'update_house_rules',
      actorId: 'p1',
      houseRules: { assassinationMode: 'official' },
    })

    state = run(state, { type: 'start_game', actorId: 'p1' })
    expect(state.room.houseRules.assassinationMode).toBe('official')
  })
})
