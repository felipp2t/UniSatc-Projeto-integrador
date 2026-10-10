import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'

const { getMe, logout, refresh } = vi.hoisted(() => ({
  getMe: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/api/endpoints', () => ({
  authApi: { logout, refresh },
  userApi: { getMe },
}))

import { createSessionService } from './session'

afterEach(() => {
  getMe.mockReset()
  logout.mockReset()
  refresh.mockReset()
})

describe('session service', () => {
  it('reinitializes after asynchronous session expiration', async () => {
    const session = createSessionService()
    const firstUser = {
      email: 'first@example.com',
      id: 'first-id',
      name: 'First',
    }
    const secondUser = {
      email: 'second@example.com',
      id: 'second-id',
      name: 'Second',
    }
    getMe
      .mockResolvedValueOnce({ data: firstUser })
      .mockResolvedValueOnce({ data: secondUser })

    await session.initialize()
    session.handleSessionExpired()
    await session.initialize()

    expect(getMe).toHaveBeenCalledTimes(2)
    expect(session.status).toBe('authenticated')
    expect(session.user).toEqual(secondUser)
    session.dispose()
  })

  it('stays unauthenticated when a pending user request resolves after expiration', async () => {
    const session = createSessionService()
    let resolveGetMe!: (value: {
      data: { email: string; id: string; name: string }
    }) => void
    getMe.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetMe = resolve
        })
    )

    const initialization = session.initialize()
    session.handleSessionExpired()
    resolveGetMe({
      data: { email: 'user@example.com', id: 'user-id', name: 'User' },
    })
    await initialization

    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeUndefined()
    session.dispose()
  })

  it('does not navigate to login when expiration happens during initialization', async () => {
    const session = createSessionService()
    const navigateToLogin = vi.fn()
    session.setNavigateToLogin(navigateToLogin)
    let resolveGetMe!: (value: {
      data: { email: string; id: string; name: string }
    }) => void
    getMe.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetMe = resolve
        })
    )

    const initialization = session.initialize()
    session.handleSessionExpired()
    resolveGetMe({
      data: { email: 'user@example.com', id: 'user-id', name: 'User' },
    })
    await initialization

    expect(navigateToLogin).not.toHaveBeenCalled()
    session.dispose()
  })

  it('navigates to login when expiration happens after initialization', async () => {
    const session = createSessionService()
    const navigateToLogin = vi.fn()
    session.setNavigateToLogin(navigateToLogin)
    getMe.mockResolvedValue({
      data: { email: 'user@example.com', id: 'user-id', name: 'User' },
    })

    await session.initialize()
    session.handleSessionExpired()

    expect(navigateToLogin).toHaveBeenCalledOnce()
    session.dispose()
  })

  it('marks the session unauthenticated for an unauthorized user', async () => {
    const session = createSessionService()
    getMe.mockRejectedValue(new ApiError('Não autorizado', 401))

    await session.initialize()

    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeUndefined()
    session.dispose()
  })

  it('reinitializes after an unauthorized bootstrap when the user logs in', async () => {
    const session = createSessionService()
    const user = { email: 'user@example.com', id: 'user-id', name: 'User' }
    getMe
      .mockRejectedValueOnce(new ApiError('Não autorizado', 401))
      .mockResolvedValueOnce({ data: user })

    await session.initialize()
    await session.initialize()

    expect(getMe).toHaveBeenCalledTimes(2)
    expect(session.status).toBe('authenticated')
    expect(session.user).toEqual(user)
    session.dispose()
  })

  it('propagates transient errors without expiring the session', async () => {
    const session = createSessionService()
    const error = new ApiError('Serviço indisponível', 503)
    getMe.mockRejectedValue(error)

    await expect(session.initialize()).rejects.toBe(error)
    expect(session.status).toBe('error')
    expect(session.user).toBeUndefined()
    session.dispose()
  })

  it('retries initialization after a transient error', async () => {
    const session = createSessionService()
    const user = { email: 'user@example.com', id: 'user-id', name: 'User' }
    getMe
      .mockRejectedValueOnce(new ApiError('Falha de rede'))
      .mockResolvedValueOnce({ data: user })

    await expect(session.initialize()).rejects.toBeInstanceOf(ApiError)
    await expect(session.initialize()).resolves.toBeUndefined()

    expect(getMe).toHaveBeenCalledTimes(2)
    expect(session.status).toBe('authenticated')
    expect(session.user).toEqual(user)
    session.dispose()
  })

  it('logs out and clears the authenticated user after the API succeeds', async () => {
    const session = createSessionService()
    const user = { email: 'user@example.com', id: 'user-id', name: 'User' }
    getMe.mockResolvedValue({ data: user })
    logout.mockResolvedValue(undefined)
    await session.initialize()

    await session.logout()

    expect(logout).toHaveBeenCalledOnce()
    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeUndefined()
    session.dispose()
  })

  it('keeps the session when logout fails with a transient error', async () => {
    const session = createSessionService()
    const user = { email: 'user@example.com', id: 'user-id', name: 'User' }
    const error = new ApiError('Serviço indisponível', 503)
    getMe.mockResolvedValue({ data: user })
    logout.mockRejectedValue(error)
    await session.initialize()

    await expect(session.logout()).rejects.toBe(error)

    expect(session.status).toBe('authenticated')
    expect(session.user).toEqual(user)
    session.dispose()
  })

  it('clears the local session when logout reports unauthorized', async () => {
    const session = createSessionService()
    const user = { email: 'user@example.com', id: 'user-id', name: 'User' }
    getMe.mockResolvedValue({ data: user })
    logout.mockRejectedValue(new ApiError('Não autorizado', 401))
    await session.initialize()

    await expect(session.logout()).resolves.toBeUndefined()

    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeUndefined()
    session.dispose()
  })

  it('does not restore a user when initialization finishes after logout', async () => {
    const session = createSessionService()
    let resolveGetMe!: (value: {
      data: { email: string; id: string; name: string }
    }) => void
    getMe.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetMe = resolve
        })
    )
    logout.mockResolvedValue(undefined)

    const initialization = session.initialize()
    await session.logout()
    resolveGetMe({
      data: { email: 'user@example.com', id: 'user-id', name: 'User' },
    })
    await initialization

    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeUndefined()
    session.dispose()
  })
})
