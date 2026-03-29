import { describe, expect, it } from 'vitest'
import {
  isValidRoomCode,
  normalizeRoomCode,
  randomRoomCode,
  ROOM_CODE_LENGTH,
} from '../lib/room'

describe('room code helpers', () => {
  it('generates fixed-length uppercase A-Z0-9 room codes', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = randomRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true)
      expect(isValidRoomCode(code)).toBe(true)
    }
  })

  it('normalizes lowercase and strips non-alphanumeric characters', () => {
    expect(normalizeRoomCode('ab-12 cd')).toBe('AB12CD')
    expect(normalizeRoomCode('aBc123')).toBe('ABC123')
  })

  it('treats room code input as case-insensitive for validation', () => {
    expect(isValidRoomCode('abc123')).toBe(true)
    expect(isValidRoomCode('AbC123')).toBe(true)
    expect(isValidRoomCode('AB!123')).toBe(false)
    expect(isValidRoomCode('AB123')).toBe(false)
  })
})
