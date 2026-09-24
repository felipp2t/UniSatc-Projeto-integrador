import axios, { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ApiError } from '@/api/errors'
import { createSessionService } from './session'

function unauthorized(config: InternalAxiosRequestConfig) {
  return new axios.AxiosError(
    'Não autorizado',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    {
      config,
      data: { message: 'Não autorizado', status: 401 },
      headers: {},
      status: 401,
      statusText: 'Unauthorized',
    }
  )
}

describe('session and auth interceptor integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refreshes a 401 from /me and authenticates the session', async () => {
    const previousAdapter = apiClient.defaults.adapter
    const session = createSessionService()
    let meCalls = 0
    const adapter = vi.fn((config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        return Promise.resolve({
          config,
          data: null,
          headers: {},
          status: 200,
          statusText: 'OK',
        })
      }

      meCalls += 1
      if (meCalls === 1) {
        return Promise.reject(unauthorized(config))
      }

      return Promise.resolve({
        config,
        data: { email: 'user@example.com', id: 'user-id', name: 'User' },
        headers: {},
        status: 200,
        statusText: 'OK',
      })
    })
    apiClient.defaults.adapter = adapter

    try {
      await session.initialize()

      expect(session.status).toBe('authenticated')
      expect(session.user).toEqual({
        email: 'user@example.com',
        id: 'user-id',
        name: 'User',
      })
      expect(adapter).toHaveBeenCalledTimes(3)
    } finally {
      session.dispose()
      apiClient.defaults.adapter = previousAdapter
    }
  })

  it('expires only when refresh is unauthorized', async () => {
    const previousAdapter = apiClient.defaults.adapter
    const session = createSessionService()
    const navigateToLogin = vi.fn()
    session.setNavigateToLogin(navigateToLogin)
    const adapter = vi.fn((config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        return Promise.reject(unauthorized(config))
      }

      return Promise.reject(unauthorized(config))
    })
    apiClient.defaults.adapter = adapter

    try {
      await expect(session.initialize()).resolves.toBeUndefined()

      expect(session.status).toBe('unauthenticated')
      expect(navigateToLogin).not.toHaveBeenCalled()
    } finally {
      session.dispose()
      apiClient.defaults.adapter = previousAdapter
    }
  })

  it('navigates to login when an authenticated session expires asynchronously', async () => {
    const previousAdapter = apiClient.defaults.adapter
    const session = createSessionService()
    const navigateToLogin = vi.fn()
    session.setNavigateToLogin(navigateToLogin)
    const adapter = vi.fn((config: InternalAxiosRequestConfig) => {
      if (config.url === '/me') {
        return Promise.resolve({
          config,
          data: { email: 'user@example.com', id: 'user-id', name: 'User' },
          headers: {},
          status: 200,
          statusText: 'OK',
        })
      }

      return Promise.reject(unauthorized(config))
    })
    apiClient.defaults.adapter = adapter

    try {
      await session.initialize()
      expect(session.status).toBe('authenticated')

      await expect(apiClient.get('/protected')).rejects.toMatchObject({
        status: 401,
      })

      expect(session.status).toBe('unauthenticated')
      expect(session.user).toBeUndefined()
      expect(navigateToLogin).toHaveBeenCalledOnce()
      expect(adapter).toHaveBeenCalledTimes(3)
    } finally {
      session.dispose()
      apiClient.defaults.adapter = previousAdapter
    }
  })

  it('does not expire on a transient refresh failure', async () => {
    const previousAdapter = apiClient.defaults.adapter
    const session = createSessionService()
    const navigateToLogin = vi.fn()
    session.setNavigateToLogin(navigateToLogin)
    const refreshError = new ApiError('Serviço indisponível', 503)
    const adapter = vi.fn((config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        return Promise.reject(refreshError)
      }

      return Promise.reject(unauthorized(config))
    })
    apiClient.defaults.adapter = adapter

    try {
      await expect(session.initialize()).rejects.toBe(refreshError)

      expect(session.status).toBe('error')
      expect(navigateToLogin).not.toHaveBeenCalled()
    } finally {
      session.dispose()
      apiClient.defaults.adapter = previousAdapter
    }
  })
})
