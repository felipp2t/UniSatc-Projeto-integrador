import { useEffect } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { env } from '@/config/env'

interface IncomingMessage {
  notification: { content: string; id: string; title: string }
  type: 'notification'
}

export function useNotificationToast() {
  useEffect(() => {
    if (!env.websocketUrl) return

    let socket: WebSocket | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let disposed = false

    async function connect() {
      if (disposed) return

      try {
        const { data } = await apiClient.post<{ ticket: string }>(
          '/api/ws-ticket'
        )
        const { ticket } = data
        if (disposed) return

        const url = new URL('/api/ws/notifications', env.websocketUrl)
        url.searchParams.set('ticket', ticket)
        socket = new WebSocket(url)
        socket.onopen = () => {
          attempts = 0
        }
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as IncomingMessage
            if (message.type === 'notification') {
              toast(message.notification.title, {
                description: message.notification.content,
                id: message.notification.id,
              })
            }
          } catch {
            // Ignore malformed frames.
          }
        }
        socket.onclose = scheduleReconnect
        socket.onerror = () => socket?.close()
      } catch {
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (disposed) return
      const delay = Math.min(1000 * 2 ** attempts, 30_000)
      attempts += 1
      reconnectTimer = setTimeout(connect, delay)
    }

    connect().catch(() => undefined)
    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])
}
