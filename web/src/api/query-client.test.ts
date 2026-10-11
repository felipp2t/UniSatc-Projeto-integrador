import { onlineManager, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import { retryQuery } from './query-client'

afterEach(() => onlineManager.setOnline(true))

describe('retryQuery', () => {
  it('retries network errors and server errors at most twice', () => {
    const network = new ApiError('offline', undefined, undefined, undefined, {
      networkError: true,
    })
    const server = new ApiError('server', 500)

    expect(retryQuery(0, network)).toBe(true)
    expect(retryQuery(1, network)).toBe(true)
    expect(retryQuery(2, network)).toBe(false)
    expect(retryQuery(0, server)).toBe(true)
    expect(retryQuery(1, server)).toBe(true)
    expect(retryQuery(2, server)).toBe(false)
  })

  it('does not retry client, canceled, or unknown errors', () => {
    expect(retryQuery(0, new ApiError('bad request', 400))).toBe(false)
    expect(
      retryQuery(
        0,
        new ApiError('canceled', undefined, undefined, undefined, {
          canceled: true,
        })
      )
    ).toBe(false)
    expect(retryQuery(0, new Error('bug'))).toBe(false)
  })

  it('runs mutations immediately while offline and rejects through mutateAsync', async () => {
    onlineManager.setOnline(false)
    const mutationFn = vi.fn().mockRejectedValue(new Error('offline'))
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { networkMode: 'always', retry: false } },
    })
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn,
      networkMode: 'always',
      retry: false,
    })

    await expect(mutation.execute(undefined)).rejects.toThrow('offline')
    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(mutation.state.isPaused).toBe(false)
    queryClient.clear()
  })
})
