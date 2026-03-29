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

function dismissAllConnected(state: GameState) {
  let next = state
  for (const player of next.players.filter((entry) => entry.connected)) {
    next = run(next, { type: 'dismiss_reveal', actorId: player.actorId })
  }
  return next
}

function approveProposal(state: GameState, team: string[]) {
  let next = state
  const leader = next.players[next.round.leaderOrder].actorId
  next = run(next, {
    type: 'propose_team',
    actorId: leader,
    team,
  })

  for (const player of next.players) {
    next = run(next, {
      type: 'cast_proposal_vote',
      actorId: player.actorId,
      approve: true,
    })
  }

  return next
}

describe('engine', () => {
  it('reject tie counts as rejection and 5 rejections gives evil win', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })
    state = dismissAllConnected(state)

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

      state = run(state, {
        type: 'advance_proposal_vote_reveal',
        actorId: state.hostActorId,
      })
    }

    expect(state.phase).toBe('game_end')
    expect(state.winner).toBe('evil')
    expect(state.winningReason).toContain('Five consecutive rejected teams')
  })

  it('allows good player to submit fail card by default', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })
    state = dismissAllConnected(state)

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
    state = run(state, {
      type: 'advance_proposal_vote_reveal',
      actorId: state.hostActorId,
    })

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
    state = dismissAllConnected(state)

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
    state = run(state, {
      type: 'advance_proposal_vote_reveal',
      actorId: state.hostActorId,
    })

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

  it('reveals proposal votes before advancing to the next phase', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })
    state = dismissAllConnected(state)

    const team = state.players.slice(0, 2).map((player) => player.actorId)
    state = approveProposal(state, team)

    expect(state.phase).toBe('proposal_vote_reveal')
    expect(state.round.proposalApproved).toBe(true)
    expect(Object.keys(state.round.proposalVotes)).toHaveLength(5)

    state = run(state, {
      type: 'advance_proposal_vote_reveal',
      actorId: state.hostActorId,
    })

    expect(state.phase).toBe('quest_vote')
    expect(state.round.proposedTeam).toEqual(team)
  })

  it('does not deadlock private reveal when a player disconnects', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })

    for (const player of state.players.slice(0, 4)) {
      state = run(state, { type: 'dismiss_reveal', actorId: player.actorId })
    }

    state = run(state, {
      type: 'player_connection',
      actorId: 'p5',
      connected: false,
    })

    expect(state.phase).toBe('team_proposal')
  })

  it('aborts a quest cleanly if a quest member disconnects mid-vote', () => {
    let state = setupFivePlayers()
    state = run(state, { type: 'start_game', actorId: 'p1' })
    state = dismissAllConnected(state)

    const team = state.players.slice(0, 2).map((player) => player.actorId)
    state = approveProposal(state, team)
    state = run(state, {
      type: 'advance_proposal_vote_reveal',
      actorId: state.hostActorId,
    })

    state = run(state, {
      type: 'player_connection',
      actorId: team[0],
      connected: false,
    })

    expect(state.phase).toBe('team_proposal')
    expect(state.round.proposedTeam).toEqual([])
    expect(state.round.questVotes).toEqual({})
  })

  it('stores a private Lady of the Lake alignment result until acknowledged', () => {
    let state = setupFivePlayers()
    state = run(state, {
      type: 'update_roles',
      actorId: 'p1',
      enabledRoles: {
        ...state.room.enabledRoles,
        ladyOfTheLake: true,
      },
    })
    state = run(state, { type: 'start_game', actorId: 'p1' })
    state.phase = 'lady_of_lake'
    state.round.ladyHolderId = 'p1'
    state.round.ladyCheckedIds = ['p1']

    const expectedAlignment = state.assignments.find((assignment) => assignment.actorId === 'p2')?.alignment
    state = run(state, {
      type: 'lady_peek',
      actorId: 'p1',
      targetId: 'p2',
    })

    expect(state.round.ladyPeekResult).toEqual({
      holderId: 'p1',
      targetId: 'p2',
      alignment: expectedAlignment,
    })
    expect(state.phase).toBe('lady_of_lake')

    state = run(state, {
      type: 'lady_acknowledge',
      actorId: 'p1',
    })

    expect(state.phase).toBe('team_proposal')
    expect(state.round.ladyHolderId).toBe('p2')
  })

  it('resolves assassination confirmation on timeout using missing votes as reject', () => {
    let state = setupFivePlayers()
    state.phase = 'assassination'
    state.assignments = [
      { actorId: 'p1', role: 'assassin', alignment: 'evil' },
      { actorId: 'p2', role: 'minion', alignment: 'evil' },
      { actorId: 'p3', role: 'oberon', alignment: 'evil' },
      { actorId: 'p4', role: 'merlin', alignment: 'good' },
      { actorId: 'p5', role: 'loyal_servant', alignment: 'good' },
    ]
    state.assassination = {
      assassinId: 'p1',
      suspectId: 'p4',
      eligibleVoters: ['p1', 'p2'],
      votes: { p1: 'confirm' },
      deadlineAt: Date.now() - 1,
    }

    state = run(state, {
      type: 'assassination_timeout',
      actorId: 'p1',
    })

    expect(state.phase).toBe('game_end')
    expect(state.winner).toBe('good')
    expect(state.winningReason).toContain('confirmation vote failed')
  })
})
