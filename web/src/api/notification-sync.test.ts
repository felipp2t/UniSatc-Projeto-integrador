import { describe, expect, it, vi } from 'vitest'
import { notification, notificationPage } from '@/test/notification-fixtures'
import { createNotificationSync } from './notification-sync'

const { list } = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/endpoints', () => ({ notificationsApi: { list } }))

function setup() {
  list.mockReset()
  const receive = vi.fn()
  return {
    receive,
    signal: new AbortController().signal,
    sync: createNotificationSync(receive),
  }
}

describe('persisted notification synchronization', () => {
  it('does not replay history on entry and emits new notifications once in chronological order', async () => {
    const { receive, sync, signal } = setup()
    list.mockResolvedValue(notificationPage([notification('old')]))
    await sync(signal)
    expect(receive).toHaveBeenLastCalledWith([])
    list.mockResolvedValue(
      notificationPage([
        notification('newest'),
        notification('new'),
        notification('old'),
      ])
    )
    await sync(signal)
    expect(receive).toHaveBeenLastCalledWith([
      notification('new'),
      notification('newest'),
    ])
    await sync(signal)
    expect(receive).toHaveBeenLastCalledWith([])
  })

  it('recovers more than a page of missed notifications and deduplicates shifted pages', async () => {
    const { receive, sync, signal } = setup()
    list.mockResolvedValueOnce(notificationPage([notification('old')]))
    await sync(signal)
    const first = Array.from({ length: 100 }, (_, index) =>
      notification(String(150 - index))
    )
    const second = Array.from({ length: 51 }, (_, index) =>
      notification(String(51 - index))
    )
    list.mockResolvedValueOnce(notificationPage(first, 0, 2))
    list.mockResolvedValueOnce(
      notificationPage([...second, notification('old')], 1, 2)
    )
    await sync(signal)
    expect(list).toHaveBeenLastCalledWith(1, 100, signal)
    const [recovered] = receive.mock.lastCall ?? []
    expect(recovered).toHaveLength(150)
    expect(recovered[0].id).toBe('1')
    expect(recovered[149].id).toBe('150')
  })

  it('recovers an initially empty history', async () => {
    const { receive, sync, signal } = setup()
    list.mockResolvedValueOnce(notificationPage([]))
    await sync(signal)
    list.mockResolvedValueOnce(notificationPage([notification('first')]))
    await sync(signal)
    expect(receive).toHaveBeenLastCalledWith([notification('first')])
  })

  it('does not advance the cursor on a failed page, so retry recovers the entire batch', async () => {
    const { receive, sync, signal } = setup()
    list.mockResolvedValueOnce(notificationPage([notification('old')]))
    await sync(signal)
    list.mockResolvedValueOnce(notificationPage([notification('newest')], 0, 2))
    list.mockRejectedValueOnce(new Error('Unavailable'))
    await expect(sync(signal)).rejects.toThrow('Unavailable')
    expect(receive).toHaveBeenCalledTimes(1)
    list.mockResolvedValueOnce(notificationPage([notification('newest')], 0, 2))
    list.mockResolvedValueOnce(
      notificationPage([notification('new'), notification('old')], 1, 2)
    )
    await sync(signal)
    expect(receive).toHaveBeenLastCalledWith([
      notification('new'),
      notification('newest'),
    ])
  })

  it('discards a response received after cancellation', async () => {
    const { receive, sync } = setup()
    const controller = new AbortController()
    list.mockImplementation(() => {
      controller.abort()
      return Promise.resolve(notificationPage([notification('old')]))
    })
    await sync(controller.signal)
    expect(receive).not.toHaveBeenCalled()
  })
})
