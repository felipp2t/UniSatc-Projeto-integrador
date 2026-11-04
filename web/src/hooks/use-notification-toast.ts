import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { notificationKeys } from '@/api/notification-keys'
import { startNotificationStream } from '@/api/notification-stream'
import { createNotificationSync } from '@/api/notification-sync'
import { appToast } from '@/components/ui/toast'
import { getNotificationHref } from '@/lib/notification-navigation'
import { useNotificationRead } from './use-notification-read'

export function useNotificationToast() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { markRead } = useNotificationRead()
  const markNotificationRead = markRead.mutateAsync

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const synchronize = createNotificationSync((notifications) => {
      queryClient
        .invalidateQueries({ queryKey: notificationKeys.all })
        .catch(() => undefined)
      for (const notification of notifications) {
        const href = getNotificationHref(notification.metadata)
        appToast(notification.title, {
          action: href
            ? {
                label: 'Abrir',
                onClick: () => {
                  navigate({ to: href }).catch(() =>
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
