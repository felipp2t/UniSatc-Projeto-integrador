// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAttachmentUpload } from './use-attachment-upload'

describe('useAttachmentUpload', () => {
  it('aborts the in-flight upload when unmounted', async () => {
    const { result, unmount } = renderHook(() => useAttachmentUpload())
    let signal: AbortSignal | undefined
    const pending = result.current.upload(({ signal: received }) => {
      signal = received
      return new Promise<void>((resolve) => {
        received.addEventListener('abort', () => resolve(), { once: true })
      })
    })

    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
    await pending
  })

  it('does not abort a finished upload on unmount', async () => {
    const { result, unmount } = renderHook(() => useAttachmentUpload())
    let signal: AbortSignal | undefined
    await result.current.upload(({ signal: received }) => {
      signal = received
      return Promise.resolve()
    })

    unmount()
    expect(signal?.aborted).toBe(false)
  })

  it('aborts the active signal on cancel', async () => {
    const { result } = renderHook(() => useAttachmentUpload())
    let signal: AbortSignal | undefined
    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.upload(({ signal: received }) => {
        signal = received
        return new Promise<void>((resolve) => {
          received.addEventListener('abort', () => resolve(), { once: true })
        })
      })
    })

    expect(signal?.aborted).toBe(false)
    act(() => result.current.cancel())
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      await pending
    })
  })

  it('does nothing on cancel when no upload is active', () => {
    const { result } = renderHook(() => useAttachmentUpload())

    expect(() => result.current.cancel()).not.toThrow()
  })

  it('exposes progress during the upload and resets it afterwards', async () => {
    const { result } = renderHook(() => useAttachmentUpload())
    let finish: () => void = () => undefined
    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.upload(({ onUploadProgress }) => {
        onUploadProgress(55)
        return new Promise<void>((resolve) => {
          finish = resolve
        })
      })
    })

    await waitFor(() => expect(result.current.progress).toBe(55))
    await act(async () => {
      finish()
      await pending
    })
    expect(result.current.progress).toBeUndefined()
  })

  it('resets progress when the upload fails', async () => {
    const { result } = renderHook(() => useAttachmentUpload())
    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.upload(({ onUploadProgress }) => {
        onUploadProgress(80)
        return Promise.reject(new Error('upload failed'))
      })
      pending.catch(() => undefined)
    })

    await act(async () => {
      await expect(pending).rejects.toThrow('upload failed')
    })
    expect(result.current.progress).toBeUndefined()
  })

  it('does not abort the active upload on re-render', async () => {
    const { rerender, result, unmount } = renderHook(() =>
      useAttachmentUpload()
    )
    let signal: AbortSignal | undefined
    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.upload(({ signal: received }) => {
        signal = received
        return new Promise<void>((resolve) => {
          received.addEventListener('abort', () => resolve(), { once: true })
        })
      })
    })

    rerender()
    rerender()
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
    await pending
  })

  it('aborts the previous upload when a new one starts', async () => {
    const { result } = renderHook(() => useAttachmentUpload())
    const signals: AbortSignal[] = []
    const send = ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    }
    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    act(() => {
      first = result.current.upload(send)
    })
    act(() => {
      second = result.current.upload(send)
    })

    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
    act(() => result.current.cancel())
    expect(signals[1]?.aborted).toBe(true)
    await act(async () => {
      await Promise.all([first, second])
    })
  })

  it('keeps the newer upload cancellable after the older one settles', async () => {
    const { result } = renderHook(() => useAttachmentUpload())
    const signals: AbortSignal[] = []
    const send = ({ signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    }
    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    act(() => {
      first = result.current.upload(send)
    })
    act(() => {
      second = result.current.upload(send)
    })
    await act(async () => {
      await first
    })

    act(() => result.current.cancel())
    expect(signals[1]?.aborted).toBe(true)
    await act(async () => {
      await second
    })
  })
})
