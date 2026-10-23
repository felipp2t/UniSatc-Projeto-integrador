// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { createQueryClient } from '@/api/query-client'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'
import '@/test/dom-setup'

const folderAId = '00000000-0000-0000-0000-000000000001'
const folderBId = '00000000-0000-0000-0000-000000000002'
const folderAName = /Folder A/i
const aChildName = /A child/i
const bChildName = /B child/i
const firstPageFolderName = /First page folder/i
const secondPageFolderName = /Second page folder/i
const workspaceId = 'workspace-1'

const apiMocks = vi.hoisted(() => ({
  collectionsList: vi.fn(),
  collectionsPath: vi.fn(),
  itemsList: vi.fn(),
  workspaceList: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: {
      ...actual.collectionsApi,
      list: apiMocks.collectionsList,
      path: apiMocks.collectionsPath,
    },
    itemsApi: { ...actual.itemsApi, list: apiMocks.itemsList },
    workspaceApi: { ...actual.workspaceApi, list: apiMocks.workspaceList },
  }
})

vi.mock('@/components/create-item-dialog', () => ({
  CreateItemDialog: ({ onItemCreated }: { onItemCreated: () => void }) =>
    createElement(
      'button',
      { onClick: onItemCreated, type: 'button' },
      'Simulate item created'
    ),
}))

import { routeTree } from '@/route-tree.gen'

function collectionPage(
  items: Array<{ id: string; name: string; parentId: string | null }>,
  page = 0,
  totalPages = 1
) {
  return {
    data: {
      items,
      page,
      size: 100,
      totalItems: items.length,
      totalPages,
    },
  }
}

function itemPage(page = 0, type: 'link' | 'secret' | 'text' = 'text') {
  return {
    data: {
      items: [
        {
          collectionId: null,
          id: `item-${page}`,
          linkUrl: null,
          preview: null,
          textContent: null,
          title: `Item ${page}`,
          type,
        },
      ],
      page,
      size: 100,
      totalItems: 200,
      totalPages: 2,
    },
  }
}

function createSession(): SessionService {
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    setNavigateToLogin: vi.fn(),
    status: 'authenticated',
    user: { email: 'user@example.com', id: 'user-1', name: 'User' },
  }
}

async function renderAt(entry: string) {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({
    queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
  })
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session: createSession(),
    } satisfies RouterContext,
    history: createMemoryHistory({ initialEntries: [entry] }),
    isServer: false,
    routeTree,
    ...routerDefaults,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  router.updateLatestLocation()
  await router.load({ sync: true })

  const rendered = renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
  return { router, ...rendered }
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.workspaceList.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace' }],
  })
  apiMocks.collectionsList.mockResolvedValue(collectionPage([]))
  apiMocks.collectionsPath.mockImplementation(async (_id, collectionId) => ({
    data: [
      {
        id: collectionId,
        name: collectionId === folderAId ? 'Folder A' : 'Folder B',
      },
    ],
  }))
  apiMocks.itemsList.mockResolvedValue(itemPage(0))
})

afterEach(() => vi.restoreAllMocks())

describe('workspace collection navigation', () => {
  it('normalizes a malformed collection id to the workspace root', async () => {
    const { router } = await renderAt('/?collectionId=not-a-guid')

    expect(
      await screen.findByText('Este workspace ainda não tem pastas.')
    ).toBeInTheDocument()
    expect(router.state.location.search.collectionId).toBeUndefined()
    expect(apiMocks.collectionsPath).not.toHaveBeenCalled()
    expect(apiMocks.collectionsList).toHaveBeenCalledWith(
      workspaceId,
      undefined,
      0,
      100
    )
  })

  it('returns to the root once when both collection queries fail as unavailable', async () => {
    const error = new ApiError('Not found', 404)
    apiMocks.collectionsList.mockRejectedValue(error)
    apiMocks.collectionsPath.mockRejectedValue(error)
    const toastError = vi.spyOn(toast, 'error')

    const { router } = await renderAt(`/?collectionId=${folderAId}`)

    await waitFor(() => {
      expect(router.state.location.search.collectionId).toBeUndefined()
    })
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('shows a retry action for transient path failures', async () => {
    apiMocks.collectionsPath
      .mockRejectedValueOnce(new ApiError('Server unavailable', 503))
      .mockResolvedValueOnce({
        data: [{ id: folderAId, name: 'Folder A' }],
      })
    const user = userEvent.setup()

    await renderAt(`/?collectionId=${folderAId}`)

    await user.click(
      await screen.findByRole('button', { name: 'Tentar novamente' })
    )
    expect(
      await screen.findByRole('heading', { name: 'Folder A' })
    ).toBeInTheDocument()
  })

  it('returns to the workspace from a transient path failure', async () => {
    apiMocks.collectionsPath.mockRejectedValue(
      new ApiError('Server unavailable', 503)
    )
    const user = userEvent.setup()
    const { router } = await renderAt(`/?collectionId=${folderAId}`)

    await user.click(
      await screen.findByRole('link', { name: 'Voltar ao workspace' })
    )

    await waitFor(() => {
      expect(router.state.location.search.collectionId).toBeUndefined()
    })
  })

  it('does not show a previous folder list while a new folder is loading', async () => {
    let resolveFolderB:
      | ((result: ReturnType<typeof collectionPage>) => void)
      | undefined
    apiMocks.collectionsList.mockImplementation((_id, collectionId) => {
      if (collectionId === folderAId) {
        return Promise.resolve(
          collectionPage([
            { id: folderBId, name: 'A child', parentId: folderAId },
          ])
        )
      }
      if (collectionId === folderBId) {
        return new Promise((resolve) => {
          resolveFolderB = resolve
        })
      }
      return Promise.resolve(
        collectionPage([{ id: folderAId, name: 'Folder A', parentId: null }])
      )
    })
    const user = userEvent.setup()
    const { router } = await renderAt('/')

    await user.click(await screen.findByRole('link', { name: folderAName }))
    expect(
      await screen.findByRole('link', { name: aChildName })
    ).toBeInTheDocument()

    await act(async () => {
      await router.navigate({ search: { collectionId: folderBId }, to: '/' })
    })

    expect(await screen.findByText('Carregando pastas…')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: aChildName })
    ).not.toBeInTheDocument()

    await act(() => {
      resolveFolderB?.(
        collectionPage([
          { id: folderAId, name: 'B child', parentId: folderBId },
        ])
      )
    })
    expect(
      await screen.findByRole('link', { name: bChildName })
    ).toBeInTheDocument()
  })

  it('keeps prior data only between pages of the same folder and disables paging while it is shown', async () => {
    let resolveSecondPage:
      | ((result: ReturnType<typeof collectionPage>) => void)
      | undefined
    apiMocks.collectionsList.mockImplementation((_id, _parentId, page) => {
      if (page === 1) {
        return new Promise((resolve) => {
          resolveSecondPage = resolve
        })
      }
      return Promise.resolve(
        collectionPage(
          [{ id: folderAId, name: 'First page folder', parentId: null }],
          0,
          2
        )
      )
    })
    const user = userEvent.setup()
    await renderAt('/')

    const initialCollections = await screen.findByRole('region', {
      name: 'Pastas',
    })
    await user.click(
      within(initialCollections).getByRole('button', { name: 'Próxima' })
    )
    await waitFor(() => {
      expect(apiMocks.collectionsList).toHaveBeenCalledWith(
        workspaceId,
        undefined,
        1,
        100
      )
    })

    expect(
      screen.getByRole('link', { name: firstPageFolderName })
    ).toBeInTheDocument()
    const collectionsSection = screen.getByRole('region', { name: 'Pastas' })
    expect(
      within(collectionsSection).getByRole('button', { name: 'Anterior' })
    ).toBeDisabled()
    expect(
      within(collectionsSection).getByRole('button', { name: 'Próxima' })
    ).toBeDisabled()

    await act(() => {
      resolveSecondPage?.(
        collectionPage(
          [{ id: folderBId, name: 'Second page folder', parentId: null }],
          1,
          2
        )
      )
    })
    expect(
      await screen.findByRole('link', { name: secondPageFolderName })
    ).toBeInTheDocument()
  })

  it.each([0, 1])(
    'returns to the last valid subfolder page when an empty page reports %s total pages',
    async (totalPages) => {
      apiMocks.collectionsList.mockImplementation((_id, _parentId, page) => {
        if (page === 1) {
          return Promise.resolve(collectionPage([], 1, totalPages))
        }

        return Promise.resolve(
          collectionPage(
            [
              {
                id: folderAId,
                name: 'First page folder',
                parentId: null,
              },
            ],
            0,
            2
          )
        )
      })
      const user = userEvent.setup()
      await renderAt('/')

      const collections = await screen.findByRole('region', {
        name: 'Pastas',
      })
      await user.click(
        within(collections).getByRole('button', { name: 'Próxima' })
      )

      expect(
        await screen.findByRole('link', { name: firstPageFolderName })
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Nenhuma pasta encontrada')
      ).not.toBeInTheDocument()
    }
  )

  it('does not redirect when a later collection page returns a bad request', async () => {
    apiMocks.collectionsList.mockImplementation((_id, _parentId, page) => {
      if (page === 1) return Promise.reject(new ApiError('Invalid page', 400))
      return Promise.resolve(
        collectionPage(
          [{ id: folderAId, name: 'First page folder', parentId: null }],
          0,
          2
        )
      )
    })
    const user = userEvent.setup()
    const { router } = await renderAt('/')

    await screen.findByRole('link', { name: firstPageFolderName })
    const collections = screen.getByRole('region', { name: 'Pastas' })
    await user.click(
      within(collections).getByRole('button', { name: 'Próxima' })
    )

    expect(await screen.findByText('Invalid page')).toBeInTheDocument()
    expect(router.state.location.search.collectionId).toBeUndefined()
  })

  it('resets item pagination when navigating to another folder', async () => {
    apiMocks.collectionsList.mockImplementation(async (_id, collectionId) =>
      collectionId
        ? collectionPage([])
        : collectionPage([{ id: folderAId, name: 'Folder A', parentId: null }])
    )
    const user = userEvent.setup()
    const { router } = await renderAt('/')

    await screen.findByText('Página 1 de 2')
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()

    await act(async () => {
      await router.navigate({ search: { collectionId: folderAId }, to: '/' })
    })
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument()
  })

  it('keeps pagination available when the item type filter hides the current page', async () => {
    apiMocks.itemsList.mockImplementation(async (_id, _collectionId, page) =>
      itemPage(page, page === 0 ? 'text' : 'secret')
    )
    const user = userEvent.setup()
    await renderAt('/')

    await screen.findByRole('heading', { name: 'Item 0' })
    await user.click(
      screen.getByRole('combobox', { name: 'Filtrar itens por tipo' })
    )
    await user.click(await screen.findByRole('option', { name: 'Segredo' }))

    const items = screen.getByRole('region', { name: 'Itens' })
    expect(
      within(items).getByText(
        'Nenhum item encontrado nesta página. Use a paginação para consultar outras páginas.'
      )
    ).toBeInTheDocument()
    await user.click(within(items).getByRole('button', { name: 'Próxima' }))
    expect(
      await screen.findByRole('heading', { name: 'Item 1' })
    ).toBeInTheDocument()
  })

  it('keeps a way back when the requested item page is empty and beyond the end', async () => {
    apiMocks.itemsList.mockImplementation(async (_id, _collectionId, page) =>
      page === 0
        ? itemPage(0)
        : {
            data: {
              items: [],
              page,
              size: 100,
              totalItems: 100,
              totalPages: 1,
            },
          }
    )
    const user = userEvent.setup()
    await renderAt('/')

    await screen.findByRole('heading', { name: 'Item 0' })
    const items = await screen.findByRole('region', { name: 'Itens' })
    await user.click(within(items).getByRole('button', { name: 'Próxima' }))

    expect(
      await within(items).findByText('Nenhum item encontrado nesta página.')
    ).toBeInTheDocument()
    await user.click(within(items).getByRole('button', { name: 'Anterior' }))
    expect(
      await screen.findByRole('heading', { name: 'Item 0' })
    ).toBeInTheDocument()
  })

  it('invalidates item queries across folders after an item is created', async () => {
    const user = userEvent.setup()
    const { queryClient } = await renderAt('/')
    const anotherFolderItemsKey = ['items', workspaceId, folderBId, 1]
    queryClient.setQueryData(anotherFolderItemsKey, itemPage(1).data)

    await user.click(
      await screen.findByRole('button', { name: 'Simulate item created' })
    )

    await waitFor(() => {
      expect(
        queryClient.getQueryState(anotherFolderItemsKey)?.isInvalidated
      ).toBe(true)
    })
  })
})
