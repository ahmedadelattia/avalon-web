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
