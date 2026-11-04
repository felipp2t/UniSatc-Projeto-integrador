import type { AppRoute } from '@/types/navigation'

export function getNotificationHref(
  metadata: Record<string, unknown>
): AppRoute | undefined {
  switch (metadata.event) {
    case 'PROFILE_UPDATED':
    case 'PASSWORD_CHANGED':
      return '/configuracoes'
    case 'ACCESS_CHANGED':
      return '/'
    default:
      return undefined
  }
}
