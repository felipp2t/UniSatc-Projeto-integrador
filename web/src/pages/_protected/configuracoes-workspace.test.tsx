// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'

const workspaceApiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  listMembers: vi.fn(),
}))
const inviteApiMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    inviteApi: {
      ...actual.inviteApi,
      create: inviteApiMocks.create,
      list: inviteApiMocks.list,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      list: workspaceApiMocks.list,
      listMembers: workspaceApiMocks.listMembers,
    },
  }
})

import { routeTree } from '@/route-tree.gen'

const workspaceId = 'workspace-1'
const ownerId = 'owner-1'
const retryButtonName = /tentar novamente|recarregar/i
const members = [
  {
    email: 'ana@example.com',
    id: 'membership-1',
    name: 'Ana Owner',
    roleName: 'owner',
    userId: ownerId,
  },
  {
    email: 'bia@example.com',
    id: 'membership-2',
    name: 'Bia Member',
    roleName: 'member',
    userId: 'member-2',
  },
]

function createSession(userId: string): SessionService {
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    setNavigateToLogin: vi.fn(),
    status: 'authenticated',
    updateUser: vi.fn(),
    user: { email: 'user@example.com', id: userId, name: 'User' },
  }
}

async function renderWorkspaceSettings(userId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session: createSession(userId),
    } satisfies RouterContext,
    history: createMemoryHistory({
      initialEntries: ['/configuracoes-workspace'],
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
  return renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  workspaceApiMocks.list.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace', ownerId }],
  })
  workspaceApiMocks.listMembers.mockResolvedValue({ data: members })
  inviteApiMocks.create.mockResolvedValue(undefined)
  inviteApiMocks.list.mockResolvedValue({ data: [] })
})

afterEach(() => vi.restoreAllMocks())

describe('workspace members settings', () => {
  it('shows emails only to the workspace owner and filters by name and role', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('bia@example.com')).toBeInTheDocument()
    expect(workspaceApiMocks.listMembers).toHaveBeenCalledWith(workspaceId)

    await user.type(
      screen.getByRole('textbox', { name: 'Buscar membro por nome' }),
      'Bia'
    )
    expect(screen.getByText('Bia Member')).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()

    await user.clear(
      screen.getByRole('textbox', { name: 'Buscar membro por nome' })
    )
    await user.click(
      screen.getByRole('combobox', { name: 'Filtrar por cargo' })
    )
    await user.click(await screen.findByRole('option', { name: 'owner' }))
    expect(screen.getByText('Ana Owner')).toBeInTheDocument()
    expect(screen.queryByText('Bia Member')).not.toBeInTheDocument()
  }, 10_000)

  it('hides emails from non-owners and disables member removal', async () => {
    await renderWorkspaceSettings('member-2')

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'E-mail' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remover Bia Member' })
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Cargo de Bia Member' })
    ).toBeDisabled()
    expect(screen.queryByRole('tab', { name: 'Convites' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
  })

  it('shows member count, invites and invite action to the owner', async () => {
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('tab', { name: 'Membros (2)' })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Convites' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeInTheDocument()
  })

  it('loads invites only after opening the tab and refreshes after creating one', async () => {
    const user = userEvent.setup()
    const existingInvite = {
      createdAt: '2026-10-20T12:00:00Z',
      email: 'existing@example.com',
      expiresAt: '2026-11-03T12:00:00Z',
      id: 'invite-1',
      invitedByName: 'Ana Owner',
      invitedByUserId: ownerId,
    }
    const createdInvite = {
      ...existingInvite,
      email: 'new@example.com',
      id: 'invite-2',
    }
    inviteApiMocks.list
      .mockResolvedValueOnce({ data: [existingInvite] })
      .mockResolvedValueOnce({ data: [existingInvite, createdInvite] })
    await renderWorkspaceSettings(ownerId)

    await screen.findByRole('tab', { name: 'Convites' })
    expect(inviteApiMocks.list).not.toHaveBeenCalled()
    await user.click(screen.getByRole('tab', { name: 'Convites' }))
    expect(await screen.findByText('existing@example.com')).toBeInTheDocument()
    expect(inviteApiMocks.list).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Convidar' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('E-mail'), 'new@example.com')
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )

    await waitFor(() => expect(inviteApiMocks.create).toHaveBeenCalledOnce())
    expect(inviteApiMocks.create).toHaveBeenCalledWith({
      email: 'new@example.com',
    })
    expect(await screen.findByText('new@example.com')).toBeInTheDocument()
    expect(inviteApiMocks.list).toHaveBeenCalledTimes(2)
  })

  it('locks the role select only for the signed-in member', async () => {
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Cargo de Bia Member' })
    ).toBeEnabled()
  })

  it('protects the last owner and never simulates a removal the API cannot perform', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('button', { name: 'Remover Ana Owner' })
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remover Bia Member' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Bia Member')
    expect(
      screen.getByRole('button', { name: 'Remoção indisponível' })
    ).toBeDisabled()
  })

  it('shows an empty result when no members match the search', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    await screen.findByText('Ana Owner')
    await user.type(
      screen.getByRole('textbox', { name: 'Buscar membro por nome' }),
      'Ninguém'
    )

    expect(await screen.findByText('Nenhum resultado')).toBeInTheDocument()
  })

  it('offers retry when the members request fails', async () => {
    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new Error('Request failed')
    )
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByText('Não foi possível carregar os membros.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: retryButtonName })
    ).toBeInTheDocument()
  })

  it('does not request members with an empty workspace ID when workspace loading is retried', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.list
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockResolvedValueOnce({
        data: [{ id: workspaceId, name: 'Workspace', ownerId }],
      })
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('button', {
        name: retryButtonName,
      })
    )

    await waitFor(() => {
      expect(workspaceApiMocks.listMembers).toHaveBeenCalledWith(workspaceId)
    })
    expect(workspaceApiMocks.listMembers).not.toHaveBeenCalledWith('')
  })

  it('hides cached member rows after the members request fails', async () => {
    workspaceApiMocks.listMembers.mockResolvedValueOnce({ data: members })
    const { queryClient } = await renderWorkspaceSettings(ownerId)
    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()

    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new Error('Access denied')
    )
    await queryClient.invalidateQueries({
      queryKey: ['workspace-members', workspaceId],
    })
    expect(
      await screen.findByText('Não foi possível carregar os membros.')
    ).toBeInTheDocument()

    expect(screen.queryByText('Ana Owner')).not.toBeInTheDocument()
  })
})
