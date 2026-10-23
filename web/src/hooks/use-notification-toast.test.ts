// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { useNotificationToast } from './use-notification-toast'

const eventSources = vi.hoisted(() => ({ instances: [] as MockEventSource[] }))

class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  listeners = new Map<string, EventListener>()
  close = vi.fn()
  addEventListener = vi.fn((type: string, listener: EventListener) => {
    this.listeners.set(type, listener)
  })
  removeEventListener = vi.fn((type: string) => {
    this.listeners.delete(type)
  })
  url: string | URL
  init?: EventSourceInit

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url
    this.init = init
    eventSources.instances.push(this)
  }
}

vi.stubGlobal('EventSource', MockEventSource)
vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('sonner', () => ({ toast: vi.fn() }))

describe('useNotificationToast', () => {
  beforeEach(() => {
    eventSources.instances = []
    vi.mocked(apiClient.get).mockReset()
  })

  afterEach(() => vi.restoreAllMocks())

  it('loads and displays the notification announced by the SSE stream', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        notifications: [
          {
            content: 'Updated access',
            id: 'notice-1',
            title: 'Access changed',
          },
        ],
      },
    } as never)
    renderHook(() => useNotificationToast())

    const [source] = eventSources.instances
    expect(source.url.toString()).toBe(
      'http://localhost:8080/notifications/stream'
    )
    expect(source.init).toEqual({ withCredentials: true })

    act(() => {
      source.listeners.get('notification')?.(
        new MessageEvent('notification', { data: 'notice-1' })
      )
    })

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Access changed', {
        description: 'Updated access',
        id: 'notice-1',
      })
    )
    expect(apiClient.get).toHaveBeenCalledWith('/notifications', {
      params: { page: 0, size: 20 },
    })
  })

  it('closes the stream and suppresses a response after unmount', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }) as never
    )
    const { unmount } = renderHook(() => useNotificationToast())
    const [source] = eventSources.instances

    act(() => {
      source.listeners.get('notification')?.(
        new MessageEvent('notification', { data: 'notice-1' })
      )
    })
    unmount()
    resolveRequest?.({
      data: {
        notifications: [
          {
            content: 'Updated access',
            id: 'notice-1',
            title: 'Access changed',
          },
        ],
      },
    })
    await act(async () => Promise.resolve())

    expect(source.removeEventListener).toHaveBeenCalledWith(
      'notification',
      expect.any(Function)
    )
    expect(source.close).toHaveBeenCalledOnce()
    expect(toast).not.toHaveBeenCalled()
  })
})
