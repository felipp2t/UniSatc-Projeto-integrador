export const inviteQueryKey = ['invites']

export function isInviteExpired(expiresAt: string, now = Date.now()) {
  return Date.parse(expiresAt) <= now
}
