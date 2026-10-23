import { useEffect } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { env } from '@/config/env'

interface NotificationResponse {
  content: string
  id: string
  title: string
}

interface NotificationPageResponse {
  notifications: NotificationResponse[]
}

export function useNotificationToast() {
  useEffect(() => {
    if (typeof EventSource === 'undefined') return

    const url = new URL('/notifications/stream', env.apiUrl)
    const source = new EventSource(url, { withCredentials: true })
    let disposed = false

    const onNotification = (event: Event) => {
      const notificationId = (event as MessageEvent<string>).data
      apiClient
        .get<NotificationPageResponse>('/notifications', {
          params: { page: 0, size: 20 },
        })
        .then(({ data }) => {
          if (disposed) return
          const notification = data.notifications.find(
            ({ id }) => id === notificationId
          )
          if (!notification) return

          toast(notification.title, {
            description: notification.content,
            id: notification.id,
          })
        })
        .catch(() => undefined)
    }

    source.addEventListener('notification', onNotification)

    return () => {
      disposed = true
      source.removeEventListener('notification', onNotification)
      source.close()
    }
  }, [])
}
