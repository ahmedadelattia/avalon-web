const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomRoomCode(length = 6): string {
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
