// @vitest-environment happy-dom

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectionKeys } from '@/api/collection-keys'
import { collectionsApi } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import type { CollectionPageResponse, CollectionResponse } from '@/api/types'
import { useCollectionMutations } from './use-collection-mutations'

const apiMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: {
      ...actual.collectionsApi,
      create: apiMocks.create,
      list: apiMocks.list,
      remove: apiMocks.remove,
      rename: apiMocks.rename,
    },
  }
})

const workspaceId = 'workspace-id'
const collectionId = 'collection-id'
const parentId = 'parent-id'

function collection(
  id: string,
  name: string,
  parent: string | null
): CollectionResponse {
  return { id, name, parentId: parent }
}

function page(
  items: CollectionResponse[],
  pageNumber: number,
  totalItems: number,
  totalPages: number
): CollectionPageResponse {
  return {
    items,
    page: pageNumber,
    size: 100,
    totalItems,
    totalPages,
  }
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 0 },
    },
  })
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollectionMutations(), { wrapper })
  return { ...hook, queryClient }
}

function deferred<T>() {
  let rejectPromise: (reason?: unknown) => void = () => undefined
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject
    resolvePromise = resolve
  })
  return { promise, reject: rejectPromise, resolve: resolvePromise }
}

beforeEach(() => {
  apiMocks.create.mockReset()
  apiMocks.list.mockReset()
  apiMocks.remove.mockReset()
  apiMocks.rename.mockReset()
})

afterEach(() => vi.restoreAllMocks())

describe('useCollectionMutations', () => {
  it.each([
    ['workspace root', undefined],
    ['nested collection', parentId],
  ])('cancels list queries before snapshot for %s', async (_label, parent) => {
    apiMocks.rename.mockResolvedValue({
      data: collection(collectionId, 'Updated', parent ?? null),
    })
    const { queryClient, result } = setup()
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries')
    const getQueriesData = vi.spyOn(queryClient, 'getQueriesData')
    const oldPage = page(
      [collection(collectionId, 'Original', parent ?? null)],
      0,
      1,
      1
    )
    queryClient.setQueryData(
      collectionKeys.list(workspaceId, parent, 0),
      oldPage
    )

    await act(async () => {
      await result.current.rename.mutateAsync({
        collectionId,
        name: 'Updated',
        parentId: parent,
        workspaceId,
      })
    })

    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: collectionKeys.lists(workspaceId, parent),
    })
    expect(cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(
      getQueriesData.mock.invocationCallOrder[0]
    )
    expect(
      queryClient.getQueryData(collectionKeys.list(workspaceId, parent, 0))
    ).toEqual(
      page([collection(collectionId, 'Updated', parent ?? null)], 0, 1, 1)
    )
    const pathKey = collectionKeys.path(workspaceId, collectionId)
    queryClient.setQueryData(pathKey, [{ id: collectionId, name: 'Updated' }])
    await result.current.rename.mutateAsync({
      collectionId,
      name: 'Updated again',
      parentId: parent,
      workspaceId,
    })
    expect(queryClient.getQueryState(pathKey)?.isInvalidated).toBe(true)
  })

  it('restores exact snapshots across cached pages after a rename conflict', async () => {
    const error = new ApiError('Conflict', 409)
    apiMocks.rename.mockRejectedValue(error)
    const { queryClient, result } = setup()
    const firstPage = page(
      [collection(collectionId, 'Before', null)],
      0,
      101,
      2
    )
    const secondPage = page(
      [collection('another-id', 'Other', null)],
      1,
      101,
      2
    )
    const firstKey = collectionKeys.list(workspaceId, undefined, 0)
    const secondKey = collectionKeys.list(workspaceId, undefined, 1)
    queryClient.setQueryData(firstKey, firstPage)
    queryClient.setQueryData(secondKey, secondPage)

    await act(async () => {
      await expect(
        result.current.rename.mutateAsync({
          collectionId,
          name: 'Conflicting name',
          parentId: undefined,
          workspaceId,
        })
      ).rejects.toBe(error)
    })

    expect(queryClient.getQueryData(firstKey)).toEqual(firstPage)
    expect(queryClient.getQueryData(secondKey)).toEqual(secondPage)
  })

  it('optimistically removes the last folder and clears its own caches on success', async () => {
    const pending = deferred<{ data: undefined }>()
    apiMocks.remove.mockReturnValue(pending.promise)
    const { queryClient, result } = setup()
    const parentListKey = collectionKeys.list(workspaceId, parentId, 0)
    const deletedChildListKey = collectionKeys.list(
      workspaceId,
      collectionId,
      0
    )
    const deletedPathKey = collectionKeys.path(workspaceId, collectionId)
    queryClient.setQueryData(
      parentListKey,
      page([collection(collectionId, 'Last folder', parentId)], 0, 1, 1)
    )
    queryClient.setQueryData(deletedChildListKey, page([], 0, 0, 0))
    queryClient.setQueryData(deletedPathKey, [
      { id: collectionId, name: 'Last folder' },
    ])

    let mutation: Promise<unknown> | undefined
    await act(async () => {
      mutation = result.current.remove.mutateAsync({
        collectionId,
        parentId,
        workspaceId,
      })
      await Promise.resolve()
    })

    expect(queryClient.getQueryData(parentListKey)).toEqual(page([], 0, 0, 0))
    pending.resolve({ data: undefined })
    await act(async () => {
      await mutation
    })

    expect(queryClient.getQueryData(deletedChildListKey)).toBeUndefined()
    expect(queryClient.getQueryData(deletedPathKey)).toBeUndefined()
  })

  it('keeps the collection caches intact when deletion fails', async () => {
    const error = new ApiError('Not empty', 409)
    apiMocks.remove.mockRejectedValue(error)
    const { queryClient, result } = setup()
    const parentListKey = collectionKeys.list(workspaceId, undefined, 0)
    const original = page([collection(collectionId, 'Folder', null)], 0, 1, 1)
    queryClient.setQueryData(parentListKey, original)
    queryClient.setQueryData(collectionKeys.path(workspaceId, collectionId), [
      { id: collectionId, name: 'Folder' },
    ])

    await act(async () => {
      await expect(
        result.current.remove.mutateAsync({
          collectionId,
          parentId: undefined,
          workspaceId,
        })
      ).rejects.toBe(error)
    })

    expect(queryClient.getQueryData(parentListKey)).toEqual(original)
    expect(
      queryClient.getQueryData(collectionKeys.path(workspaceId, collectionId))
    ).toEqual([{ id: collectionId, name: 'Folder' }])
  })

  it('does not optimistically insert on create and refetches after onSettled', async () => {
    const createPending = deferred<{ data: CollectionResponse }>()
    apiMocks.create.mockReturnValue(createPending.promise)
    apiMocks.list.mockResolvedValue({
      data: page([collection('existing-id', 'Existing', null)], 0, 1, 1),
    })
    const { queryClient, result } = setup()
    const queryKey = collectionKeys.list(workspaceId, undefined, 0)
    const listHook = renderHook(
      () =>
        useQuery({
          queryFn: async () =>
            (await collectionsApi.list(workspaceId, undefined, 0, 100)).data,
          queryKey,
        }),
      {
        wrapper: ({ children }: PropsWithChildren) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    )
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(1))
    const original = queryClient.getQueryData(queryKey)

    let mutation: Promise<{ data: CollectionResponse }> | undefined
    await act(async () => {
      mutation = result.current.create.mutateAsync({
        request: { name: 'New folder' },
        workspaceId,
      })
      await Promise.resolve()
    })
    expect(queryClient.getQueryData(queryKey)).toEqual(original)
    expect(apiMocks.list).toHaveBeenCalledTimes(1)

    createPending.resolve({
      data: collection('new-id', 'New folder', null),
    })
    await act(async () => {
      await mutation
    })
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(2))
    expect(queryClient.getQueryData(queryKey)).toEqual(
      page([collection('existing-id', 'Existing', null)], 0, 1, 1)
    )
    listHook.unmount()
  })
})
