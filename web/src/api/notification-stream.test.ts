import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockEventSource } from '@/test/mock-event-source'
import { ApiError } from './errors'
import { startNotificationStream } from './notification-stream'

vi.mock('@/config/env', () => ({
  env: { apiUrl: 'https://example.test/api/' },
}))

beforeEach(() => {
  vi.useFakeTimers()
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function flush() {
  await vi.advanceTimersByTimeAsync(0)
}

describe('notification stream lifecycle', () => {
  it('authenticates through HTTP before connecting and preserves the API prefix', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startNotificationStream(sync)
    expect(MockEventSource.instances).toHaveLength(0)
    await flush()
    const [source] = MockEventSource.instances
    expect(sync).toHaveBeenCalledOnce()
    expect(source.url).toBe('https://example.test/api/notifications/stream')
    expect(source.init).toEqual({ withCredentials: true })
    source.open()
    await flush()
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
    expect(source.close).toHaveBeenCalledOnce()
    expect(source.onopen).toBeNull()
    expect(source.onerror).toBeNull()
    expect(source.listeners.size).toBe(0)
  })

  it('lets the browser reconnect CONNECTING streams and recovers persisted data on open', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startNotificationStream(sync)
    await flush()
    const [source] = MockEventSource.instances
    source.fail(MockEventSource.CONNECTING)
    await vi.advanceTimersByTimeAsync(5000)
    expect(MockEventSource.instances).toHaveLength(1)
    expect(source.close).not.toHaveBeenCalled()
    source.open()
    await flush()
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
  })

  it('revalidates the session and replaces a CLOSED stream with backoff', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startNotificationStream(sync)
    await flush()
    MockEventSource.instances[0].fail()
    await vi.advanceTimersByTimeAsync(999)
    expect(sync).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(sync).toHaveBeenCalledTimes(2)
    expect(MockEventSource.instances).toHaveLength(2)
    MockEventSource.instances[1].fail()
    await vi.advanceTimersByTimeAsync(1999)
    expect(MockEventSource.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(MockEventSource.instances).toHaveLength(3)
    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(MockEventSource.instances).toHaveLength(3)
  })

  it.each([401, 403])(
    'stops after HTTP rejects the session with %i',
    async (status) => {
      const sync = vi.fn().mockRejectedValue(new ApiError('Denied', status))
      const stop = startNotificationStream(sync)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(sync).toHaveBeenCalledOnce()
      expect(MockEventSource.instances).toHaveLength(0)
      stop()
    }
  )

  it('retries transient HTTP failures with a capped delay', async () => {
    const sync = vi.fn().mockRejectedValue(new ApiError('Unavailable', 503))
    const stop = startNotificationStream(sync)
    await vi.advanceTimersByTimeAsync(61_000)
    expect(sync).toHaveBeenCalledTimes(7)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledTimes(8)
    stop()
  })

  it('coalesces events during an in-flight sync without concurrent requests', async () => {
    let release: (() => void) | undefined
    const sync = vi.fn().mockResolvedValue(undefined)
    const stop = startNotificationStream(sync)
    await flush()
    sync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    const [source] = MockEventSource.instances
    source.notify()
    for (let index = 0; index < 100; index += 1) source.notify()
    expect(sync).toHaveBeenCalledTimes(2)
    release?.()
    await flush()
    expect(sync).toHaveBeenCalledTimes(3)
    stop()
  })

  it('aborts an in-flight request and never connects after disposal', async () => {
    let release: (() => void) | undefined
    const sync = vi.fn(
      (_signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    const stop = startNotificationStream(sync)
    const [[signal]] = sync.mock.calls
    stop()
    expect(signal.aborted).toBe(true)
    release?.()
    await flush()
    expect(MockEventSource.instances).toHaveLength(0)
  })
})
