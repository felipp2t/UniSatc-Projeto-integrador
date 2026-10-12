import { onlineManager } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import { createQueryClient, retryQuery } from './query-client'

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
    expect(
      retryQuery(
        0,
        new AxiosError('invalid configuration', 'ERR_BAD_OPTION_VALUE')
      )
    ).toBe(false)
  })

  it('runs mutations immediately while offline and rejects without retrying', async () => {
    onlineManager.setOnline(false)
    const mutationFn = vi.fn().mockRejectedValue(new Error('offline'))
    const queryClient = createQueryClient()
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn,
    })

    try {
      await expect(mutation.execute(undefined)).rejects.toThrow('offline')
      expect(mutationFn).toHaveBeenCalledTimes(1)
      expect(mutation.state.isPaused).toBe(false)
    } finally {
      queryClient.clear()
    }
  })
})
