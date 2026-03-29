const ROOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const ROOM_CODE_LENGTH = 6
export const SOLO_TEST_ROOM_CODE = 'TESTRM'

export function isSoloTestRoomCode(input: string): boolean {
  return normalizeRoomCode(input) === SOLO_TEST_ROOM_CODE
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input)
  return /^[A-Z0-9]{6}$/.test(normalized) || normalized === SOLO_TEST_ROOM_CODE
}

export function randomRoomCode(length = ROOM_CODE_LENGTH): string {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(
        (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) *
          ROOM_ALPHABET.length,
      )
      code += ROOM_ALPHABET[idx]
    }
  } while (code === SOLO_TEST_ROOM_CODE)
  return code
}

export function extractRoomCodeFromLocation(locationLike: {
  search: string
  pathname: string
}): string | null {
  const params = new URLSearchParams(locationLike.search)
  const fromQuery = params.get('room')
  if (fromQuery && isValidRoomCode(fromQuery)) {
    const normalized = normalizeRoomCode(fromQuery)
    if (normalized === SOLO_TEST_ROOM_CODE) return SOLO_TEST_ROOM_CODE
    return normalized.slice(0, ROOM_CODE_LENGTH)
  }

  const match = locationLike.pathname.match(/\/room\/([A-Za-z0-9]{6})\/?$/)
  if (match?.[1] && isValidRoomCode(match[1])) {
    return normalizeRoomCode(match[1]).slice(0, ROOM_CODE_LENGTH)
  }

  return null
}

export function buildInviteUrl(roomCode: string, origin?: string): string {
  const normalizedRoomCode = normalizeRoomCode(roomCode)
  const normalized = isSoloTestRoomCode(normalizedRoomCode)
    ? SOLO_TEST_ROOM_CODE
    : normalizedRoomCode.slice(0, ROOM_CODE_LENGTH)
  const baseOrigin = origin ?? window.location.origin
  return `${baseOrigin}/?room=${normalized}`
}
