import type { AppRoute } from '@/types/navigation'

export type NotificationDestination =
  | { to: '/'; search?: { collectionId: string } | { itemId: string } }
  | { to: '/configuracoes/conta' }

export function getNotificationDestination(
  metadata: Record<string, unknown>
): NotificationDestination | undefined {
  switch (metadata.event) {
    case 'PROFILE_UPDATED':
    case 'PASSWORD_CHANGED':
      return { to: '/configuracoes/conta' }
    default:
      if (metadata.event !== 'ACCESS_CHANGED') return undefined
      if (
        typeof metadata.resourceId === 'string' &&
        metadata.resourceType === 'collection'
      ) {
        return { search: { collectionId: metadata.resourceId }, to: '/' }
      }
      if (
        typeof metadata.resourceId === 'string' &&
        metadata.resourceType === 'item'
      ) {
        return { search: { itemId: metadata.resourceId }, to: '/' }
      }
      return { to: '/' }
  }
}

export function getNotificationHref(
  metadata: Record<string, unknown>
): AppRoute | undefined {
  return getNotificationDestination(metadata)?.to
}
