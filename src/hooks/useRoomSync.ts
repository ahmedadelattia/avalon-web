import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createInitialState, reduceGameState } from '../lib/engine'
import { toCommit, toIntent } from '../lib/protocol'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import type {
  ClientIntent,
  EngineAction,
  GameState,
  HostCommit,
  PlayerIdentity,
  SystemEvent,
} from '../lib/types'

interface RoomOptions {
  roomCode: string
  identity: PlayerIdentity
  isCreator: boolean
}

type TransportStatus =
  | 'offline_local'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

export function useRoomSync({ roomCode, identity, isCreator }: RoomOptions) {
  const shouldBootstrapLocalState = isCreator || !hasSupabaseConfig
  const [state, setState] = useState<GameState | null>(() =>
    shouldBootstrapLocalState ? createInitialState(roomCode, identity) : null,
  )
  const [status, setStatus] = useState<TransportStatus>(
    hasSupabaseConfig ? 'connecting' : 'offline_local',
  )
  const [error, setError] = useState<string | null>(null)

  const stateRef = useRef<GameState | null>(state)
  const appliedActionIds = useRef<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const nextState = shouldBootstrapLocalState
      ? createInitialState(roomCode, identity)
      : null
    stateRef.current = nextState
    setState(nextState)
    appliedActionIds.current = new Set()
    setError(null)
    setStatus(hasSupabaseConfig ? 'connecting' : 'offline_local')
  }, [
    identity.actorId,
    identity.displayName,
    isCreator,
    roomCode,
    shouldBootstrapLocalState,
  ])

  const sendBroadcast = useCallback(
    async (event: 'intent' | 'commit' | 'system', payload: unknown) => {
      const channel = channelRef.current
      if (!channel) {
        setError('Channel not ready yet. Please retry.')
        return
      }
      const response = await channel.send({
        type: 'broadcast',
        event,
        payload,
      })
      if (response !== 'ok') {
        setError(`Realtime send failed (${response}). Retrying...`)
      }
    },
    [],
  )

  const applyActionLocal = useCallback((action: EngineAction): GameState | null => {
    const current = stateRef.current
    if (!current) return null
    try {
      const next = reduceGameState(current, action)
      stateRef.current = next
      setState(next)
      return next
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown action error'
      setError(message)
      return null
    }
  }, [])

  const applyCommit = useCallback((commit: HostCommit) => {
    const current = stateRef.current

    if (current) {
      if (commit.hostEpoch < current.hostEpoch) return
      if (commit.hostEpoch === current.hostEpoch && commit.seq <= current.seq) {
        return
      }
    }

    stateRef.current = commit.stateSnapshotDelta
    setState(commit.stateSnapshotDelta)
    appliedActionIds.current.add(commit.actionId)
  }, [])

  const maybeCommitAsHost = useCallback(
    async (actionId: string, action: EngineAction) => {
      const current = stateRef.current
      if (!current) return
      if (current.hostActorId !== identity.actorId) return

      const next = applyActionLocal(action)
      if (!next) return

      const seq = current.seq + 1
      next.seq = seq
      setState({ ...next })
      stateRef.current = next

      if (!hasSupabaseConfig || !supabase) return

      const commit = toCommit(
        roomCode,
        identity.actorId,
        seq,
        next.hostEpoch,
        actionId,
        next,
      )

      await sendBroadcast('commit', commit)
    },
    [applyActionLocal, identity.actorId, roomCode, sendBroadcast],
  )

  const dispatch = useCallback(
    async (action: EngineAction) => {
      const current = stateRef.current
      if (!current) return

      const intent = toIntent(roomCode, identity.actorId, current.phase, action)
      if (appliedActionIds.current.has(intent.actionId)) return
      appliedActionIds.current.add(intent.actionId)

      if (!hasSupabaseConfig || !supabase) {
        applyActionLocal(action)
        return
      }

      if (current.hostActorId === identity.actorId) {
        await maybeCommitAsHost(intent.actionId, action)
        return
      }

      await sendBroadcast('intent', intent)
    },
    [applyActionLocal, identity.actorId, maybeCommitAsHost, roomCode, sendBroadcast],
  )

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return

    let cancelled = false
    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        presence: {
          key: identity.actorId,
        },
      },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, async () => {
        const current = stateRef.current
        if (!current) return
        const presenceState = channel.presenceState<Record<string, unknown>>()
        const connectedIds = new Set(Object.keys(presenceState))

        for (const player of current.players) {
          if (player.connected !== connectedIds.has(player.actorId)) {
            const next = reduceGameState(current, {
              type: 'player_connection',
              actorId: player.actorId,
              connected: connectedIds.has(player.actorId),
              now: Date.now(),
            })
            stateRef.current = next
            setState(next)
          }
        }

        if (!connectedIds.has(current.hostActorId)) {
          const candidate = [...current.players]
            .filter((p) => connectedIds.has(p.actorId))
            .sort((a, b) => a.joinOrder - b.joinOrder)[0]

          if (candidate && candidate.actorId === identity.actorId) {
            const event: SystemEvent = {
              type: 'host_migrated',
              roomCode,
              holderId: candidate.actorId,
              sentAt: Date.now(),
              hostEpoch: current.hostEpoch + 1,
            }
            await sendBroadcast('system', event)

            const migrated = reduceGameState(current, {
              type: 'set_host',
              actorId: candidate.actorId,
              hostEpoch: current.hostEpoch + 1,
              now: Date.now(),
            })
            stateRef.current = migrated
            setState(migrated)
          }
        }
      })
      .on('broadcast', { event: 'intent' }, async ({ payload }) => {
        const intent = payload as ClientIntent<EngineAction>
        if (intent.actorId === identity.actorId) return

        const current = stateRef.current
        if (!current) return
        if (current.hostActorId !== identity.actorId) return
        if (appliedActionIds.current.has(intent.actionId)) return

        appliedActionIds.current.add(intent.actionId)
        await maybeCommitAsHost(intent.actionId, intent.payload)
      })
      .on('broadcast', { event: 'commit' }, ({ payload }) => {
        const commit = payload as HostCommit
        applyCommit(commit)
      })
      .on('broadcast', { event: 'system' }, ({ payload }) => {
        const event = payload as SystemEvent
        const current = stateRef.current
        if (!current) return
        if (event.type !== 'host_migrated') return

        const next = reduceGameState(current, {
          type: 'set_host',
          actorId: event.holderId,
          hostEpoch: event.hostEpoch,
          now: Date.now(),
        })
        stateRef.current = next
        setState(next)
      })
      .subscribe(async (channelStatus) => {
        if (cancelled) return

        if (channelStatus === 'SUBSCRIBED') {
          setStatus('connected')
          await channel.track({
            actorId: identity.actorId,
            displayName: identity.displayName,
            roomCode,
            joinedAt: Date.now(),
          })

          if (isCreator) {
            const joinAction: EngineAction = {
              type: 'player_join',
              actorId: identity.actorId,
              displayName: identity.displayName,
              now: Date.now(),
            }
            await maybeCommitAsHost('creator-join', joinAction)
          } else {
            await sendBroadcast(
              'intent',
              toIntent(roomCode, identity.actorId, 'lobby', {
                type: 'player_join',
                actorId: identity.actorId,
                displayName: identity.displayName,
                now: Date.now(),
              }),
            )

            await sendBroadcast('system', {
              type: 'resync_requested',
              roomCode,
              holderId: identity.actorId,
              sentAt: Date.now(),
              hostEpoch: stateRef.current?.hostEpoch ?? 1,
            } satisfies SystemEvent)
          }
        } else if (channelStatus === 'CHANNEL_ERROR') {
          setStatus('reconnecting')
          setError('Connection error. Retrying...')
        } else if (channelStatus === 'TIMED_OUT') {
          setStatus('reconnecting')
        }
      })

    channel.on('broadcast', { event: 'system' }, async ({ payload }) => {
      const event = payload as SystemEvent
      const current = stateRef.current
      if (!current) return

      if (
        event.type === 'resync_requested' &&
        current.hostActorId === identity.actorId
      ) {
        const commit = toCommit(
          roomCode,
          identity.actorId,
          current.seq,
          current.hostEpoch,
          `resync-${Date.now()}`,
          current,
        )

        await sendBroadcast('commit', commit)
      }
    })

    return () => {
      cancelled = true
      channelRef.current = null
      channel.unsubscribe()
    }
  }, [
    applyCommit,
    identity.actorId,
    identity.displayName,
    isCreator,
    maybeCommitAsHost,
    roomCode,
    sendBroadcast,
  ])

  const transportText = useMemo(() => {
    if (!hasSupabaseConfig) {
      return 'Local mode only (set Supabase env vars for internet rooms).'
    }
    if (status === 'connected') return 'Connected'
    if (status === 'connecting') return 'Connecting...'
    if (status === 'reconnecting') return 'Reconnecting...'
    return 'Offline local mode'
  }, [status])

  return {
    state,
    setState,
    dispatch,
    status,
    transportText,
    error,
  }
}
