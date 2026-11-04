// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'
import { createSessionStub } from '@/test/session-stub'

const apiMocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  listNotifications: vi.fn(),
  listWorkspaces: vi.fn(),
  revokeInvite: vi.fn(),
  updateWorkspace: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      getWorkspace: apiMocks.getWorkspace,
      listWorkspaces: apiMocks.listWorkspaces,
      revokeInvite: apiMocks.revokeInvite,
      updateWorkspace: apiMocks.updateWorkspace,
    },
    notificationsApi: {
      ...actual.notificationsApi,
      list: apiMocks.listNotifications,
    },
  }
})

import { routeTree } from '@/route-tree.gen'

const FINANCE_CARD_NAME = /Financeiro/

const financeWorkspace = {
  createdAt: '2026-11-01T12:00:00Z',
  description: 'Equipe de finanças',
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  memberCount: 1,
  name: 'Financeiro',
  ownerEmail: 'lider@example.com',
  ownerName: 'Líder Financeiro',
  pendingInvites: [
    {
      email: 'analista@example.com',
      expiresAt: '2026-11-10T12:00:00Z',
      id: 'b3d7c2a0-1111-4f6a-9d2e-123456789abc',
      owner: false,
    },
  ],
}

async function renderAt(path: string, systemAdmin = true) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  const router = createRouter({
    context: {
      queryClient,
      session: createSessionStub({
        status: 'authenticated',
        user: {
          email: 'admin@gmail.com',
          id: 'admin-1',
          name: 'Administrador',
          systemAdmin,
        },
      }),
    } satisfies RouterContext,
    history: createMemoryHistory({ initialEntries: [path] }),
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
  return renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.listNotifications.mockResolvedValue({
    data: {
      notifications: [],
      page: 0,
      size: 10,
      totalItems: 0,
      totalPages: 0,
      unreadCount: 0,
    },
  })
  apiMocks.listWorkspaces.mockResolvedValue({ data: [financeWorkspace] })
  apiMocks.getWorkspace.mockResolvedValue({
    data: {
      members: [
        {
          email: 'lider@example.com',
          id: 'member-1',
          name: 'Líder Financeiro',
          roleId: 'role-1',
          roleName: 'Owner',
          userId: 'user-2',
        },
      ],
      workspace: financeWorkspace,
    },
  })
  apiMocks.revokeInvite.mockResolvedValue(undefined)
})

afterEach(() => vi.restoreAllMocks())

describe('administração de workspaces', () => {
  it('shows every workspace on the home page of the system admin', async () => {
    await renderAt('/')

    expect(
      await screen.findByRole('heading', { name: 'Workspaces' })
    ).toBeTruthy()
    const card = await screen.findByRole('link', { name: FINANCE_CARD_NAME })
    expect(card.getAttribute('href')).toBe(
      `/administracao/${financeWorkspace.id}`
    )
    expect(screen.getByText('1 convite(s) pendente(s)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Novo workspace' })).toBeTruthy()
  })

  it('shows settings, members and pending invites of a workspace', async () => {
    await renderAt(`/administracao/${financeWorkspace.id}`)

    expect(
      await screen.findByRole('heading', { name: 'Financeiro' })
    ).toBeTruthy()
    expect(screen.getByLabelText('Nome do workspace')).toHaveProperty(
      'value',
      'Financeiro'
    )
    expect(screen.getByText('Proprietário')).toBeTruthy()
    expect(screen.getByText('analista@example.com')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Convidar para Financeiro' })
    ).toBeTruthy()
  })

  it('revokes a pending invite', async () => {
    const user = userEvent.setup()
    await renderAt(`/administracao/${financeWorkspace.id}`)

    await user.click(
      await screen.findByRole('button', {
        name: 'Revogar convite de analista@example.com',
      })
    )

    await waitFor(() =>
      expect(apiMocks.revokeInvite).toHaveBeenCalledWith(
        financeWorkspace.id,
        'b3d7c2a0-1111-4f6a-9d2e-123456789abc'
      )
    )
  })

  it('blocks the administration page for regular users', async () => {
    await renderAt(`/administracao/${financeWorkspace.id}`, false)

    expect(await screen.findByText('Acesso restrito')).toBeTruthy()
    expect(apiMocks.getWorkspace).not.toHaveBeenCalled()
  })
})
