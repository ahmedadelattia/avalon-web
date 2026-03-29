import type { ClientIntent, EngineAction, GameState, HostCommit } from './types'

export function createActionId(): string {
  const raw = crypto.getRandomValues(new Uint32Array(2))
  return `${raw[0].toString(36)}-${raw[1].toString(36)}`
}

export function hashState(state: GameState): string {
  const json = JSON.stringify(state)
  let hash = 2166136261
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i)
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

export function toIntent(
  roomCode: string,
  actorId: string,
  phase: GameState['phase'],
  payload: EngineAction,
): ClientIntent<EngineAction> {
  return {
    actionId: createActionId(),
    roomCode,
    actorId,
    phase,
    payload,
    sentAt: Date.now(),
  }
}

export function toCommit(
  roomCode: string,
  actorId: string,
  seq: number,
  hostEpoch: number,
  actionId: string,
  state: GameState,
): HostCommit {
  return {
    seq,
    roomCode,
    actorId,
    actionId,
    hostEpoch,
    stateHash: hashState(state),
    stateSnapshotDelta: state,
    committedAt: Date.now(),
  }
}
