import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { vi } from 'vitest'
import type { SessionService } from '@/auth/session'
import { routeTree } from '@/route-tree.gen'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'
import { createSessionStub } from '@/test/session-stub'
import {
  inviteApiMocks,
  toastError,
  toastSuccess,
  workspaceApiMocks,
} from '@/test/workspace-settings-mocks'

export const workspaceId = 'workspace-1'
export const ownerId = 'owner-1'
export const members = [
  {
    email: 'ana@example.com',
    id: 'membership-1',
    name: 'Ana Owner',
    roleId: 'role-owner',
    roleName: 'Owner',
    userId: ownerId,
  },
  {
    email: 'bia@example.com',
    id: 'membership-2',
    name: 'Bia Member',
    roleId: 'role-member',
    roleName: 'Member',
    userId: 'member-2',
  },
]

function createSession(userId: string, systemAdmin: boolean): SessionService {
  return createSessionStub({
    status: 'authenticated',
    user: { email: 'user@example.com', id: userId, name: 'User', systemAdmin },
  })
}

export function setupWorkspaceSettingsMocks() {
  vi.clearAllMocks()
  workspaceApiMocks.list.mockResolvedValue({
    data: [
      {
        description: 'Workspace description',
        id: workspaceId,
        name: 'Workspace',
        ownerId,
      },
    ],
  })
  workspaceApiMocks.listMembers.mockResolvedValue({ data: members })
  workspaceApiMocks.listRoles.mockResolvedValue({
    data: [
      { id: 'role-owner', name: 'Owner' },
      { id: 'role-member', name: 'Member' },
    ],
  })
  workspaceApiMocks.changeMemberRole.mockResolvedValue({ data: members[1] })
  workspaceApiMocks.removeMember.mockResolvedValue(undefined)
  workspaceApiMocks.update.mockResolvedValue({
    data: {
      description: 'Workspace description',
      id: workspaceId,
      name: 'Workspace',
      ownerId,
    },
  })
  inviteApiMocks.create.mockResolvedValue(undefined)
  inviteApiMocks.list.mockResolvedValue({ data: [] })
  toastError.mockReset()
  toastSuccess.mockReset()
}

export async function renderWorkspaceSettings(
  userId: string,
  initialPath = '/configuracoes-workspace',
  { systemAdmin = false } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  const session = createSession(userId, systemAdmin)
  const router = createRouter({
    context: {
      queryClient,
      session,
    } satisfies RouterContext,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
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
  return {
    ...renderWithProviders(<RouterProvider router={router} />, { queryClient }),
    queryClient,
    router,
    session,
  }
}
