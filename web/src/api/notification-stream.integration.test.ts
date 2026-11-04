import axios, { type InternalAxiosRequestConfig } from 'axios'
import { expect, it, vi } from 'vitest'
import { createSessionService } from '@/auth/session'
import { MockEventSource } from '@/test/mock-event-source'
import { notification, notificationPage } from '@/test/notification-fixtures'
import { apiClient } from './client'
import { startNotificationStream } from './notification-stream'
import { createNotificationSync } from './notification-sync'

function unauthorized(config: InternalAxiosRequestConfig) {
  return new axios.AxiosError(
    'Unauthorized',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    {
      config,
      data: {},
      headers: {},
      status: 401,
      statusText: 'Unauthorized',
    }
  )
}

it.each([true, false])(
  'handles an expired access token with refresh allowed=%s',
  async (allowRefresh) => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []
    const previousAdapter = apiClient.defaults.adapter
    const session = createSessionService()
    const navigateToLogin = vi.fn()
    session.setNavigateToLogin(navigateToLogin)
    let expired = false
    const adapter = vi.fn((config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        if (!allowRefresh) return Promise.reject(unauthorized(config))
        expired = false
      } else if (expired) return Promise.reject(unauthorized(config))
      const data =
        config.url === '/notifications'
          ? notificationPage([notification('old')]).data
          : { email: 'user@example.test', id: 'user-1', name: 'User' }
      return Promise.resolve({
        config,
        data,
        headers: {},
        status: 200,
        statusText: 'OK',
      })
    })
    apiClient.defaults.adapter = adapter
    let stop: () => void = () => undefined
    try {
      await session.initialize()
      const receive = vi.fn()
      stop = startNotificationStream(createNotificationSync(receive))
      await vi.advanceTimersByTimeAsync(0)
      expect(MockEventSource.instances).toHaveLength(1)
      expired = true
      MockEventSource.instances[0].fail()
      await vi.advanceTimersByTimeAsync(1000)
      expect(
        adapter.mock.calls.some(([config]) => config.url === '/auth/refresh')
      ).toBe(true)
      expect(MockEventSource.instances).toHaveLength(allowRefresh ? 2 : 1)
      expect(session.status).toBe(
        allowRefresh ? 'authenticated' : 'unauthenticated'
      )
      expect(navigateToLogin).toHaveBeenCalledTimes(allowRefresh ? 0 : 1)
      const attempts = adapter.mock.calls.length
      if (!allowRefresh) {
        await vi.advanceTimersByTimeAsync(60_000)
        expect(adapter).toHaveBeenCalledTimes(attempts)
      }
    } finally {
      stop()
      session.dispose()
      apiClient.defaults.adapter = previousAdapter
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  }
)
