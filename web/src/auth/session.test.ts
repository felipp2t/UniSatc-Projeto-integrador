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
  it('marks the session unauthenticated for an unauthorized user', async () => {
    const session = createSessionService()
    getMe.mockRejectedValue(new ApiError('Não autorizado', 401))

    await session.initialize()

    expect(session.status).toBe('unauthenticated')
    expect(session.user).toBeUndefined()
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
