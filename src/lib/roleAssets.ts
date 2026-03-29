import type { Role } from './types'

const ROLE_PORTRAIT_MAP: Record<Role, string> = {
  merlin: '/icons/roles/merlin.webp',
  percival: '/icons/roles/percival.webp',
  loyal_servant: '/icons/roles/loyal_servant.webp',
  assassin: '/icons/roles/assassin.webp',
  morgana: '/icons/roles/morgana.webp',
  mordred: '/icons/roles/mordred.webp',
  oberon: '/icons/roles/oberon.webp',
  minion: '/icons/roles/minion.webp',
}

export function getRolePortrait(role: Role): string {
  return ROLE_PORTRAIT_MAP[role]
}
