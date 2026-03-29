import type { PlayerIdentity } from './types'

const DEVICE_KEY = 'avalon.device_id'
const NAME_KEY = 'avalon.display_name'

function randomId(prefix: string): string {
  const raw = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${raw[0].toString(36)}${raw[1].toString(36)}`
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY)
  if (existing) return existing
  const next = randomId('device')
  localStorage.setItem(DEVICE_KEY, next)
  return next
}

export function createIdentity(displayName: string): PlayerIdentity {
  const deviceId = getOrCreateDeviceId()
  const actorId = `${deviceId}`
  localStorage.setItem(NAME_KEY, displayName)
  return {
    actorId,
    deviceId,
    displayName,
  }
}

export function getStoredName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}
