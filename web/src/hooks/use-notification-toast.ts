import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { notificationKeys } from '@/api/notification-keys'
import { startNotificationStream } from '@/api/notification-stream'
import { createNotificationSync } from '@/api/notification-sync'
import type { NotificationPageResponse } from '@/api/types'
import { appToast } from '@/components/ui/toast'
import { getNotificationDestination } from '@/lib/notification-navigation'
import { useNotificationRead } from './use-notification-read'

export function useNotificationToast() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { markRead } = useNotificationRead()
  const markNotificationRead = markRead.mutateAsync

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const synchronize = createNotificationSync((notifications) => {
      if (
        notifications.some(
          ({ metadata }) => metadata.event === 'ACCESS_CHANGED'
        )
      ) {
        queryClient.setQueriesData<NotificationPageResponse>(
          { queryKey: notificationKeys.all },
          (page) =>
            page
              ? {
                  ...page,
                  notifications: page.notifications.map((notification) =>
                    notification.metadata.event === 'ACCESS_CHANGED'
                      ? {
                          ...notification,
                          metadata: { event: 'ACCESS_CHANGED' },
                        }
                      : notification
                  ),
                }
              : page
        )
      }
      queryClient
        .invalidateQueries({ queryKey: notificationKeys.all })
        .catch(() => undefined)
      for (const notification of notifications) {
        const destination = getNotificationDestination(notification.metadata)
        appToast(notification.title, {
          action: destination
            ? {
                label: 'Abrir',
                onClick: () => {
                  const navigation =
                    destination.to === '/'
                      ? destination.search
                        ? navigate({ search: destination.search, to: '/' })
                        : navigate({ to: '/' })
                      : navigate({ to: destination.to })
                  navigation.catch(() =>
                    appToast.error('Não foi possível abrir a notificação.')
                  )
                  markNotificationRead(notification.id).catch(() =>
                    appToast.error(
                      'Não foi possível marcar a notificação como lida.'
                    )
                  )
                },
              }
            : undefined,
          description: notification.content,
          duration: 5000,
          id: notification.id,
        })
      }
    })
    return startNotificationStream(synchronize)
  }, [markNotificationRead, navigate, queryClient])
}
