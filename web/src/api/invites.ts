export const inviteQueryKey = ['invites'] as const

export function isInviteExpired(expiresAt: string, now = Date.now()) {
  return Date.parse(expiresAt) <= now
}
