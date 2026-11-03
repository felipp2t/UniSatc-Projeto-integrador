import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { createElement } from 'react'
import { afterEach, beforeEach, vi } from 'vitest'
import { createQueryClient } from '@/api/query-client'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'
import { createSessionStub } from '@/test/session-stub'
import '@/test/dom-setup'

export const folderAId = '00000000-0000-0000-0000-000000000001'
export const folderBId = '00000000-0000-0000-0000-000000000002'
export const workspaceId = 'workspace-1'

const apiMocks = vi.hoisted(() => ({
  collectionsCreate: vi.fn(),
  collectionsList: vi.fn(),
  collectionsPath: vi.fn(),
  collectionsRemove: vi.fn(),
  collectionsRename: vi.fn(),
  itemsList: vi.fn(),
  workspaceList: vi.fn(),
  workspacePermissions: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: {
      ...actual.collectionsApi,
      create: apiMocks.collectionsCreate,
      list: apiMocks.collectionsList,
      path: apiMocks.collectionsPath,
      remove: apiMocks.collectionsRemove,
      rename: apiMocks.collectionsRename,
    },
    itemsApi: { ...actual.itemsApi, list: apiMocks.itemsList },
    workspaceApi: {
      ...actual.workspaceApi,
      list: apiMocks.workspaceList,
      permissions: apiMocks.workspacePermissions,
    },
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

export function collectionPage(
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

export function itemPage(page = 0, type: 'link' | 'secret' | 'text' = 'text') {
  return {
    data: {
      items: [
        {
          archivedAt: null,
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
  return createSessionStub({
    status: 'authenticated',
    user: { email: 'user@example.com', id: 'user-1', name: 'User' },
  })
}

export async function renderAt(entry: string) {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({
    queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
  })
  const router = createRouter({
    context: {
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
  apiMocks.collectionsCreate.mockResolvedValue({
    data: { id: 'created-folder', name: 'New folder', parentId: null },
  })
  apiMocks.collectionsRename.mockResolvedValue({
    data: { id: folderAId, name: 'Renamed folder', parentId: null },
  })
  apiMocks.collectionsRemove.mockResolvedValue({ data: undefined })
  apiMocks.workspaceList.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace' }],
  })
  apiMocks.workspacePermissions.mockResolvedValue({
    data: {
      isOwner: false,
      permissions: [
        { action: 'all', resource: 'collection' },
        { action: 'all', resource: 'item' },
      ],
      roleId: 'role-1',
      roleName: 'Owner',
    },
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

export { apiMocks }
