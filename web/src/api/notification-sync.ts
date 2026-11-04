import { notificationsApi } from './endpoints'
import type { NotificationResponse } from './types'

const PAGE_SIZE = 100

export function createNotificationSync(
  onNotifications: (notifications: NotificationResponse[]) => void
) {
  // undefined means no baseline yet; null means the initial history was empty.
  let latestId: string | null | undefined

  return async (signal: AbortSignal) => {
    const { data: first } = await notificationsApi.list(0, PAGE_SIZE, signal)
    if (signal.aborted) return
    const headId = first.notifications[0]?.id ?? null
    if (latestId === undefined) {
      latestId = headId
      onNotifications([])
      return
    }

    const pending = new Map<string, NotificationResponse>()
    let page = first
    for (;;) {
      const boundary = page.notifications.findIndex(({ id }) => id === latestId)
      const notifications =
        boundary < 0
          ? page.notifications
          : page.notifications.slice(0, boundary)
      for (const notification of notifications)
        pending.set(notification.id, notification)
      if (boundary >= 0 || page.page + 1 >= page.totalPages) break
      // biome-ignore lint/performance/noAwaitInLoops: stop at the cursor instead of fetching the user's entire history.
      const response = await notificationsApi.list(
        page.page + 1,
        PAGE_SIZE,
        signal
      )
      if (signal.aborted) return
      page = response.data
    }

    // Advance only after a complete recovery; a failed page is safe to retry.
    onNotifications([...pending.values()].reverse())
    latestId = headId
  }
}
