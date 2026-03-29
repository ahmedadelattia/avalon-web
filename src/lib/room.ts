const ROOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const ROOM_CODE_LENGTH = 6

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidRoomCode(input: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeRoomCode(input))
}

export function randomRoomCode(length = ROOM_CODE_LENGTH): string {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(
      (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) *
        ROOM_ALPHABET.length,
    )
    code += ROOM_ALPHABET[idx]
  }
  return code
}

export function extractRoomCodeFromLocation(locationLike: {
  search: string
  pathname: string
}): string | null {
  const params = new URLSearchParams(locationLike.search)
  const fromQuery = params.get('room')
  if (fromQuery && isValidRoomCode(fromQuery)) {
    return normalizeRoomCode(fromQuery).slice(0, ROOM_CODE_LENGTH)
  }

  const match = locationLike.pathname.match(/\/room\/([A-Za-z0-9]{6})\/?$/)
  if (match?.[1] && isValidRoomCode(match[1])) {
    return normalizeRoomCode(match[1]).slice(0, ROOM_CODE_LENGTH)
  }

  return null
}

export function buildInviteUrl(roomCode: string, origin?: string): string {
  const normalized = normalizeRoomCode(roomCode).slice(0, ROOM_CODE_LENGTH)
  const baseOrigin = origin ?? window.location.origin
  return `${baseOrigin}/?room=${normalized}`
}
