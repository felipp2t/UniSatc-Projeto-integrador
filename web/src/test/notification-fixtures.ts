import type {
  NotificationPageResponse,
  NotificationResponse,
} from '@/api/types'

export function notification(
  id: string,
  overrides: Partial<NotificationResponse> = {}
): NotificationResponse {
  return {
    content: 'Suas permissões foram alteradas.',
    createdAt: '2026-11-03T23:00:00Z',
    id,
    metadata: { event: 'ACCESS_CHANGED' },
    readAt: null,
    title: 'Acesso alterado',
    ...overrides,
  }
}

export function notificationPage(
  notifications: NotificationResponse[],
  page = 0,
  totalPages = 1
): { data: NotificationPageResponse } {
  return {
    data: {
      notifications,
      page,
      size: 100,
      totalItems: notifications.length,
      totalPages,
      unreadCount: notifications.filter(({ readAt }) => readAt === null).length,
    },
  }
}
