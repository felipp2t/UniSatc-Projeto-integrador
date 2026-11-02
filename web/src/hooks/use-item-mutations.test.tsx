// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { itemKeys } from '@/api/item-keys'
import '@/test/dom-setup'

const apiMocks = vi.hoisted(() => ({
  archive: vi.fn(),
  remove: vi.fn(),
  replaceAttachment: vi.fn(),
  restore: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return { ...actual, itemsApi: { ...actual.itemsApi, ...apiMocks } }
})

import {
  useArchiveItem,
  useDeleteItem,
  useReplaceAttachment,
  useRestoreItem,
  useUpdateItem,
} from './use-item-mutations'

const workspaceId = 'ws-1'
const listKey = itemKeys.list(workspaceId, {
  archived: false,
  collectionId: undefined,
  page: 0,
})
const detailKey = itemKeys.detail(workspaceId, 'item-1')
const attachmentKey = itemKeys.attachment(workspaceId, 'item-1')

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  queryClient.setQueryData(listKey, { items: [] })
  queryClient.setQueryData(detailKey, { id: 'item-1' })
  queryClient.setQueryData(attachmentKey, { blob: new Blob(['antigo']) })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const mock of Object.values(apiMocks)) {
    mock.mockResolvedValue({ data: undefined })
  }
})

describe('use-item-mutations', () => {
  it('arquivar invalida as listagens do workspace após o sucesso', async () => {
    const { queryClient, wrapper } = setup()
    const { result } = renderHook(() => useArchiveItem(), { wrapper })

    await result.current.mutateAsync({ itemId: 'item-1', workspaceId })

    await waitFor(() =>
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    )
    expect(apiMocks.archive).toHaveBeenCalledWith(workspaceId, 'item-1')
  })

  it('restaurar e atualizar invalidam as listagens', async () => {
    const { queryClient, wrapper } = setup()
    const restore = renderHook(() => useRestoreItem(), { wrapper })
    await restore.result.current.mutateAsync({ itemId: 'item-1', workspaceId })
    await waitFor(() =>
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    )

    queryClient.setQueryData(listKey, { items: [] })
    const update = renderHook(() => useUpdateItem(), { wrapper })
    await update.result.current.mutateAsync({
      itemId: 'item-1',
      request: { textContent: 'x', title: 't' },
      workspaceId,
    })
    await waitFor(() =>
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    )
  })

  it('não mantém as variáveis (segredo em claro) no MutationCache após desmontar', async () => {
    const { queryClient, wrapper } = setup()
    const { result, unmount } = renderHook(() => useUpdateItem(), { wrapper })

    await result.current.mutateAsync({
      itemId: 'item-1',
      request: { title: 't', value: 'segredo-em-claro' },
      workspaceId,
    })
    unmount()

    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    )
  })

  it('falha não altera o cache (sem update otimista), mas invalida para reler o servidor', async () => {
    apiMocks.archive.mockRejectedValue(new Error('falhou'))
    const { queryClient, wrapper } = setup()
    const { result } = renderHook(() => useArchiveItem(), { wrapper })

    await expect(
      result.current.mutateAsync({ itemId: 'item-1', workspaceId })
    ).rejects.toThrow('falhou')

    await waitFor(() =>
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    )
    expect(queryClient.getQueryData(listKey)).toEqual({ items: [] })
  })

  it('excluir invalida as listagens', async () => {
    const { queryClient, wrapper } = setup()
    const { result } = renderHook(() => useDeleteItem(), { wrapper })

    await result.current.mutateAsync({ itemId: 'item-1', workspaceId })

    await waitFor(() =>
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    )
    expect(apiMocks.remove).toHaveBeenCalledWith(workspaceId, 'item-1')
  })

  it('substituir anexo repassa as opções de upload e invalida o anexo em cache', async () => {
    const { queryClient, wrapper } = setup()
    const { result } = renderHook(() => useReplaceAttachment(), { wrapper })
    const file = new File(['x'], 'doc.pdf')
    const options = { signal: new AbortController().signal }

    await result.current.mutateAsync({
      file,
      itemId: 'item-1',
      options,
      workspaceId,
    })

    expect(apiMocks.replaceAttachment).toHaveBeenCalledWith(
      workspaceId,
      'item-1',
      file,
      options
    )
    await waitFor(() =>
      expect(queryClient.getQueryState(attachmentKey)?.isInvalidated).toBe(true)
    )
  })

  it('falha ao substituir anexo também invalida o anexo para reler o servidor', async () => {
    const { queryClient, wrapper } = setup()
    apiMocks.replaceAttachment.mockRejectedValue(new Error('falhou'))
    const { result } = renderHook(() => useReplaceAttachment(), { wrapper })

    await expect(
      result.current.mutateAsync({
        file: new File(['x'], 'doc.pdf'),
        itemId: 'item-1',
        workspaceId,
      })
    ).rejects.toThrow('falhou')

    await waitFor(() =>
      expect(queryClient.getQueryState(attachmentKey)?.isInvalidated).toBe(true)
    )
  })
})
