import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'

const { getMe, refresh } = vi.hoisted(() => ({
  getMe: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/api/endpoints', () => ({
  authApi: { refresh },
  userApi: { getMe },
}))

import { createSessionService } from './session'

afterEach(() => {
  getMe.mockReset()
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
})
