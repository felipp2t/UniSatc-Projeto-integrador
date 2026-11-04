// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { list } = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return { ...actual, workspaceApi: { ...actual.workspaceApi, list } }
})

import { selectAdminWorkspace } from './use-admin-workspace-selection'
import { useCurrentWorkspace } from './use-current-workspace'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

afterEach(() => {
  selectAdminWorkspace(undefined)
  list.mockReset()
})

describe('useCurrentWorkspace', () => {
  it('uses the only workspace of a regular member', async () => {
    list.mockResolvedValue({ data: [{ id: 'team-a', name: 'Equipe A' }] })

    const { result } = renderHook(() => useCurrentWorkspace(), { wrapper })

    await waitFor(() => expect(result.current.data?.id).toBe('team-a'))
  })

  it('follows the workspace opened by the system admin', async () => {
    list.mockResolvedValue({
      data: [
        { id: 'team-a', name: 'Equipe A' },
        { id: 'team-b', name: 'Equipe B' },
      ],
    })
    const { result } = renderHook(() => useCurrentWorkspace(), { wrapper })
    await waitFor(() => expect(result.current.data?.id).toBe('team-a'))

    act(() => selectAdminWorkspace('team-b'))

    await waitFor(() => expect(result.current.data?.id).toBe('team-b'))
    expect(sessionStorage.getItem('vaulty:admin-workspace')).toBe('team-b')
  })
})
