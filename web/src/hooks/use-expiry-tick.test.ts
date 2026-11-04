// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExpiryTick } from './use-expiry-tick'

afterEach(() => vi.useRealTimers())

describe('useExpiryTick', () => {
  it('rearms after an early timer callback when the wall clock moves backward', async () => {
    vi.useFakeTimers()
    const start = new Date('2026-10-28T12:00:00Z')
    vi.setSystemTime(start)
    const expiresAt = new Date(start.getTime() + 1000).toISOString()
    const { result } = renderHook(() => useExpiryTick([expiresAt]))

    vi.setSystemTime(start.getTime() - 500)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current).toBe(start.getTime())
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499)
    })
    expect(result.current).toBe(start.getTime())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result.current).toBe(Date.parse(expiresAt))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its pending expiration timer on unmount', () => {
    vi.useFakeTimers()
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const { unmount } = renderHook(() => useExpiryTick([expiresAt]))

    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
