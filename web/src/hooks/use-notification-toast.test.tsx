// @vitest-environment happy-dom

import { act, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notificationKeys } from '@/api/notification-keys'
import { MockEventSource } from '@/test/mock-event-source'
import { notification, notificationPage } from '@/test/notification-fixtures'
import { renderWithProviders } from '@/test/render'
import { useNotificationToast } from './use-notification-toast'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/api/endpoints', () => ({
  notificationsApi: {
    list: mocks.list,
    markAllRead: vi.fn(),
    markRead: mocks.markRead,
  },
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@/components/ui/toast', () => ({
  appToast: Object.assign(mocks.toast, { error: mocks.toastError }),
}))

function Listener() {
  useNotificationToast()
  return null
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.list.mockResolvedValue(notificationPage([notification('old')]))
  mocks.markRead.mockResolvedValue({})
  mocks.navigate.mockResolvedValue(undefined)
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})
afterEach(() => vi.unstubAllGlobals())

async function connect() {
  const rendered = renderWithProviders(<Listener />)
  await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
  const [source] = MockEventSource.instances
  act(() => source.open())
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
  return { source, ...rendered }
}

describe('notification toasts', () => {
  it('shows a transient toast and refreshes the notification center for a live event', async () => {
    const { source, queryClient } = await connect()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    mocks.list.mockResolvedValue(
      notificationPage([notification('new'), notification('old')])
    )
    act(() => source.notify())
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce())
    expect(mocks.toast).toHaveBeenCalledWith(
      'Acesso alterado',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Abrir' }),
        description: 'Suas permissões foram alteradas.',
        duration: 5000,
        id: 'new',
      })
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all })
    act(() => source.notify())
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(4))
    expect(mocks.toast).toHaveBeenCalledOnce()
  })

  it('recovers notifications missed during native reconnect without replaying history', async () => {
    const { source } = await connect()
    expect(mocks.toast).not.toHaveBeenCalled()
    act(() => source.fail(MockEventSource.CONNECTING))
    mocks.list.mockResolvedValue(
      notificationPage([notification('missed'), notification('old')])
    )
    act(() => source.open())
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce())
    expect(mocks.toast.mock.calls[0][1].id).toBe('missed')
  })

  it('opens only the allowed destination and marks the notification as read on request', async () => {
    const { source } = await connect()
    mocks.list.mockResolvedValue(
      notificationPage([
        notification('new', {
          metadata: {
            event: 'ACCESS_CHANGED',
            href: 'https://untrusted.test/private',
          },
        }),
        notification('old'),
      ])
    )
    act(() => source.notify())
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce())
    expect(mocks.markRead).not.toHaveBeenCalled()
    act(() => {
      mocks.toast.mock.calls[0][1].action.onClick()
    })
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalled())
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
    const [[readId]] = mocks.markRead.mock.calls
    expect(readId).toBe('new')
  })

  it('does not turn unrecognized event metadata into a navigation action', async () => {
    const { source } = await connect()
    mocks.list.mockResolvedValue(
      notificationPage([
        notification('new', {
          metadata: { event: 'UNKNOWN', href: '/secret' },
        }),
        notification('old'),
      ])
    )
    act(() => source.notify())
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce())
    expect(mocks.toast.mock.calls[0][1].action).toBeUndefined()
  })

  it('cancels pending HTTP work and suppresses a late toast after unmount', async () => {
    const { source, unmount } = await connect()
    let complete: (() => void) | undefined
    mocks.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = () =>
            resolve(
              notificationPage([notification('new'), notification('old')])
            )
        })
    )
    act(() => source.notify())
    const [, , signal] = mocks.list.mock.lastCall ?? []
    unmount()
    expect(signal.aborted).toBe(true)
    complete?.()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(source.close).toHaveBeenCalledOnce()
  })

  it('keeps only one stream under StrictMode and releases all listeners on cleanup', async () => {
    const { unmount } = renderWithProviders(
      <StrictMode>
        <Listener />
      </StrictMode>
    )
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    unmount()
    expect(MockEventSource.instances[0].close).toHaveBeenCalledOnce()
    expect(MockEventSource.instances[0].listeners.size).toBe(0)
  })
})
