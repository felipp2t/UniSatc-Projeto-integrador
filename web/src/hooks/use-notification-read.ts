import type { QueryKey } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/endpoints'
import { notificationKeys } from '@/api/notification-keys'

interface CachedNotification {
  id: string
  readAt: string | null
}

interface CachedNotificationPage {
  notifications: CachedNotification[]
  unreadCount: number
}

type NotificationSnapshot = [QueryKey, unknown][]

function isNotificationPage(value: unknown): value is CachedNotificationPage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'notifications' in value &&
    Array.isArray(value.notifications) &&
    'unreadCount' in value &&
    typeof value.unreadCount === 'number'
  )
}

function containsUnreadNotification(
  snapshots: NotificationSnapshot,
  notificationId?: string
) {
  return snapshots.some(([, data]) => {
    if (!isNotificationPage(data)) return false
    return data.notifications.some(
      (notification) =>
        notification.readAt === null &&
        (notificationId === undefined || notification.id === notificationId)
    )
  })
}

function setNotificationPages(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (page: CachedNotificationPage) => CachedNotificationPage
) {
  queryClient.setQueriesData<unknown>(
    { queryKey: notificationKeys.all },
    (data: unknown) => (isNotificationPage(data) ? update(data) : data)
  )
}

export function useNotificationRead() {
  const queryClient = useQueryClient()

  const markRead = useMutation<
    Awaited<ReturnType<typeof notificationsApi.markRead>>,
    unknown,
    string,
    { snapshots: NotificationSnapshot }
  >({
    mutationFn: notificationsApi.markRead,
    onError: (_error, _notificationId, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      const snapshots = queryClient.getQueriesData<unknown>({
        queryKey: notificationKeys.all,
      })

      if (containsUnreadNotification(snapshots, notificationId)) {
        const readAt = new Date().toISOString()
        setNotificationPages(queryClient, (page) => ({
          ...page,
          notifications: page.notifications.map((notification) =>
            notification.id === notificationId
              ? { ...notification, readAt }
              : notification
          ),
          unreadCount: Math.max(0, page.unreadCount - 1),
        }))
      }

      return { snapshots }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })

  const markAllRead = useMutation<
    Awaited<ReturnType<typeof notificationsApi.markAllRead>>,
    unknown,
    void,
    { snapshots: NotificationSnapshot }
  >({
    mutationFn: notificationsApi.markAllRead,
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })
      const snapshots = queryClient.getQueriesData<unknown>({
        queryKey: notificationKeys.all,
      })

      if (containsUnreadNotification(snapshots)) {
        const readAt = new Date().toISOString()
        setNotificationPages(queryClient, (page) => ({
          ...page,
          notifications: page.notifications.map((notification) =>
            notification.readAt === null
              ? { ...notification, readAt }
              : notification
          ),
          unreadCount: 0,
        }))
      }

      return { snapshots }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })

  return { markAllRead, markRead }
}
