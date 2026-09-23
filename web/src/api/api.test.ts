import axios, { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installAuthInterceptor, shouldSkipAuthRefresh } from './auth'
import { apiClient } from './client'
import { authApi, inviteApi, userApi, workspaceApi } from './endpoints'
import { ApiError, toApiError } from './errors'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApiError', () => {
  it('normalizes the backend error body and status', () => {
    const body = {
      message: 'Muitas requisições',
      status: 429,
    }
    const config = {
      headers: {},
      method: 'post',
      url: '/auth/login',
    } as InternalAxiosRequestConfig
    const error = toApiError(
      new axios.AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          config,
          data: body,
          headers: {},
          status: 429,
          statusText: 'Too Many Requests',
        }
      )
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(429)
    expect(error.message).toBe('Muitas requisições')
    expect(error.body).toEqual(body)
    expect(error.isRateLimited).toBe(true)
    expect(error.isUnauthorized).toBe(false)
  })

  it('identifies unauthorized responses', () => {
    const error = new ApiError('Não autorizado', 401)

    expect(error.isUnauthorized).toBe(true)
    expect(error.isRateLimited).toBe(false)
  })
})

describe('apiClient', () => {
  it('uses the configured API URL and credentials', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:8080')
    expect(apiClient.defaults.withCredentials).toBe(true)
    expect(apiClient.defaults.headers.common['Content-Type']).toBeUndefined()
  })
})

describe('endpoint helpers', () => {
  it('mounts the main API requests through the shared client', async () => {
    const adapter = vi.fn().mockResolvedValue({
      config: {} as InternalAxiosRequestConfig,
      data: null,
      headers: {},
      status: 200,
      statusText: 'OK',
    })
    const previousAdapter = apiClient.defaults.adapter
    apiClient.defaults.adapter = adapter

    const loginRequest = { email: 'user@example.com', password: 'password' }
    const inviteRequest = { email: 'invite@example.com' }

    try {
      await authApi.login(loginRequest)
      await userApi.getMe()
      await workspaceApi.list()
      await inviteApi.create(inviteRequest)
    } finally {
      apiClient.defaults.adapter = previousAdapter
    }

    expect(adapter).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: JSON.stringify(loginRequest),
        method: 'post',
        url: '/auth/login',
      })
    )
    expect(adapter).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: 'get', url: '/me' })
    )
    expect(adapter).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: 'get', url: '/workspaces' })
    )
    expect(adapter).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        data: JSON.stringify(inviteRequest),
        method: 'post',
        url: '/invites',
      })
    )
  })
})

describe('auth interceptor contract', () => {
  it('does not refresh authentication endpoints', () => {
    expect(shouldSkipAuthRefresh('/auth/login')).toBe(true)
    expect(shouldSkipAuthRefresh('/auth/refresh')).toBe(true)
    expect(shouldSkipAuthRefresh('/auth/login?source=invite')).toBe(true)
    expect(shouldSkipAuthRefresh('/auth/refresh#session')).toBe(true)
    expect(shouldSkipAuthRefresh('/me')).toBe(false)
  })

  it('retries once when the injected refresh succeeds', async () => {
    const client = axios.create()
    const refresh = vi.fn().mockResolvedValue(true)
    const config = {
      headers: {},
      method: 'get',
      url: '/me',
    } as InternalAxiosRequestConfig
    const adapter = vi
      .fn()
      .mockRejectedValueOnce(
        new axios.AxiosError(
          'Unauthorized',
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
      )
      .mockResolvedValueOnce({
        config,
        data: { id: 'user-id' },
        headers: {},
        status: 200,
        statusText: 'OK',
      })

    client.defaults.adapter = adapter
    client.interceptors.response.use(undefined, (error) =>
      Promise.reject(toApiError(error))
    )
    const interceptorId = installAuthInterceptor(client, { refresh })

    await expect(client.get('/me')).resolves.toMatchObject({ status: 200 })
    expect(refresh).toHaveBeenCalledOnce()
    client.interceptors.response.eject(interceptorId)
  })

  it('notifies expiration and does not loop when the retry is also unauthorized', async () => {
    const client = axios.create()
    const onSessionExpired = vi.fn()
    const refresh = vi.fn().mockResolvedValue(true)
    const config = {
      headers: {},
      method: 'get',
      url: '/me',
    } as InternalAxiosRequestConfig
    const unauthorizedResponse = {
      config,
      data: { message: 'Não autorizado', status: 401 },
      headers: {},
      status: 401,
      statusText: 'Unauthorized',
    }
    const adapter = vi
      .fn()
      .mockRejectedValueOnce(
        new axios.AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          unauthorizedResponse
        )
      )
      .mockRejectedValueOnce(
        new axios.AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          unauthorizedResponse
        )
      )

    client.defaults.adapter = adapter
    client.interceptors.response.use(undefined, (error) =>
      Promise.reject(toApiError(error))
    )
    const interceptorId = installAuthInterceptor(client, {
      onSessionExpired,
      refresh,
    })

    await expect(client.get('/me')).rejects.toMatchObject({ status: 401 })
    expect(refresh).toHaveBeenCalledOnce()
    expect(onSessionExpired).toHaveBeenCalledOnce()
    expect(adapter).toHaveBeenCalledTimes(2)
    client.interceptors.response.eject(interceptorId)
  })

  it('calls onSessionExpired when the injected refresh fails', async () => {
    const client = axios.create()
    const onSessionExpired = vi.fn()
    const refresh = vi.fn().mockResolvedValue(false)
    const config = {
      headers: {},
      method: 'get',
      url: '/me',
    } as InternalAxiosRequestConfig
    const adapter = vi.fn().mockRejectedValue(
      new axios.AxiosError(
        'Unauthorized',
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
    )

    client.defaults.adapter = adapter
    client.interceptors.response.use(undefined, (error) =>
      Promise.reject(toApiError(error))
    )
    const interceptorId = installAuthInterceptor(client, {
      onSessionExpired,
      refresh,
    })

    await expect(client.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(onSessionExpired).toHaveBeenCalledOnce()
    client.interceptors.response.eject(interceptorId)
  })
})
