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
    globalRole: null,
    id: 'membership-1',
    isTeamLeader: false,
    name: 'Ana Owner',
    roleName: 'Owner',
    teamId: null,
    userId: ownerId,
  },
  {
    email: 'bia@example.com',
    globalRole: null,
    id: 'membership-2',
    isTeamLeader: false,
    name: 'Bia Member',
    roleName: 'Member',
    teamId: null,
    userId: 'member-2',
  },
]

function createSession(userId: string): SessionService {
  return createSessionStub({
    status: 'authenticated',
    user: { email: 'user@example.com', id: userId, name: 'User' },
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
  workspaceApiMocks.permissions.mockResolvedValue({
    data: {
      globalRole: null,
      isOwner: true,
      isTeamLeader: false,
      permissions: [],
      roleName: 'Owner',
      teamId: null,
    },
  })
  workspaceApiMocks.assignGlobalRole.mockResolvedValue(undefined)
  workspaceApiMocks.transferOwnership.mockResolvedValue(undefined)
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
  initialPath = '/configuracoes-workspace'
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  const session = createSession(userId)
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
