// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { workspaceApi } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { workspacePermissionQueryKey } from '@/auth/permissions'
import { useWorkspacePermissions } from './use-workspace-permissions'
import '@/test/dom-setup'

vi.mock('@/api/endpoints', () => ({ workspaceApi: { permissions: vi.fn() } }))

afterEach(() => vi.resetAllMocks())

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

describe('useWorkspacePermissions', () => {
  it('denies while loading and shares the full response with other observers', async () => {
    const { client, wrapper } = setup()
    vi.mocked(workspaceApi.permissions).mockResolvedValue({
      data: {
        isOwner: true,
        permissions: [],
        roleId: 'owner',
        roleName: 'Dono',
      },
    } as never)
    const { result, unmount } = renderHook(
      () => {
        const first = useWorkspacePermissions('workspace-1')
        const second = useWorkspacePermissions('workspace-1')
        return { first, second }
      },
      { wrapper }
    )
    expect(result.current.first.can('item', 'create')).toBe(false)
    await waitFor(() => expect(result.current.first.isSuccess).toBe(true))
    expect(result.current.second.can('secret', 'read')).toBe(true)
    expect(workspaceApi.permissions).toHaveBeenCalledOnce()
    expect(
      client.getQueryData(workspacePermissionQueryKey('workspace-1'))
    ).toMatchObject({ isOwner: true, permissions: [] })
    unmount()
    client.clear()
  })

  it('denies cached grants after a failed refetch', async () => {
    const { client, wrapper } = setup()
    vi.mocked(workspaceApi.permissions).mockResolvedValue({
      data: {
        isOwner: false,
        permissions: [{ action: 'create', resource: 'item' }],
        roleId: 'editor',
        roleName: 'Editor',
      },
    } as never)
    const { result, unmount } = renderHook(
      () => useWorkspacePermissions('workspace-1'),
      { wrapper }
    )
    await waitFor(() => expect(result.current.can('item', 'create')).toBe(true))
    vi.mocked(workspaceApi.permissions).mockRejectedValue(
      new ApiError('Forbidden', 403)
    )
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.can('item', 'create')).toBe(false)
    unmount()
    client.clear()
  })
})
