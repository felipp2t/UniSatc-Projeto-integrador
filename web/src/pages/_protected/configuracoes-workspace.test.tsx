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
import { ApiError } from '@/api/errors'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'
import { createSessionStub } from '@/test/session-stub'

const workspaceApiMocks = vi.hoisted(() => ({
  changeMemberRole: vi.fn(),
  list: vi.fn(),
  listMembers: vi.fn(),
  listRoles: vi.fn(),
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
      changeMemberRole: workspaceApiMocks.changeMemberRole,
      list: workspaceApiMocks.list,
      listMembers: workspaceApiMocks.listMembers,
      listRoles: workspaceApiMocks.listRoles,
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
    roleId: 'role-owner',
    roleName: 'owner',
    userId: ownerId,
  },
  {
    email: 'bia@example.com',
    id: 'membership-2',
    name: 'Bia Member',
    roleId: 'role-member',
    roleName: 'member',
    userId: 'member-2',
  },
]

function createSession(userId: string): SessionService {
  return createSessionStub({
    status: 'authenticated',
    user: { email: 'user@example.com', id: userId, name: 'User' },
  })
}

function mockConfirm(result: boolean) {
  const confirm = vi.fn().mockReturnValue(result)
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    value: confirm,
  })
  return confirm
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
  workspaceApiMocks.listRoles.mockResolvedValue({
    data: [
      { builtIn: true, id: 'role-owner', memberCount: 1, name: 'owner' },
      { builtIn: true, id: 'role-member', memberCount: 1, name: 'member' },
    ],
  })
  workspaceApiMocks.changeMemberRole.mockResolvedValue({ data: members[1] })
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
  })

  it('hides emails and invite actions from non-owners', async () => {
    await renderWorkspaceSettings('member-2')

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'E-mail' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remover Bia Member' })
    ).not.toBeInTheDocument()
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
    expect(inviteApiMocks.create.mock.calls[0]?.[0]).toEqual({
      email: 'new@example.com',
    })
    expect(await screen.findByText('new@example.com')).toBeInTheDocument()
    expect(inviteApiMocks.list).toHaveBeenCalledTimes(2)
  })

  it('shows the role selector to owners and keeps removal unavailable', async () => {
    await renderWorkspaceSettings(ownerId)

    const ownerRole = await screen.findByRole('combobox', {
      name: 'Cargo de Bia Member',
    })
    await waitFor(() => expect(ownerRole).toBeEnabled())
    const user = userEvent.setup()
    await user.click(ownerRole)
    expect(await screen.findByRole('option', { name: 'member' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'owner' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    const removeButton = await screen.findByRole('button', {
      name: 'Remover Bia Member',
    })
    expect(removeButton).toBeDisabled()
    expect(removeButton).toHaveAttribute(
      'title',
      'A remoção ainda não está disponível na API do servidor.'
    )
  })

  it('confirms and changes a member role using the membership ID', async () => {
    const user = userEvent.setup()
    const confirm = mockConfirm(true)
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'owner' }))

    expect(confirm).toHaveBeenCalledWith('Alterar o cargo de Bia Member para owner?')
    await waitFor(() => {
      expect(workspaceApiMocks.changeMemberRole).toHaveBeenCalledWith(
        workspaceId,
        'membership-2',
        'role-owner'
      )
    })
  })

  it('does not change a role when the owner cancels confirmation', async () => {
    const user = userEvent.setup()
    mockConfirm(false)
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'owner' }))

    expect(workspaceApiMocks.changeMemberRole).not.toHaveBeenCalled()
  })

  it('blocks demoting the only owner', async () => {
    const user = userEvent.setup()
    const confirm = mockConfirm(true)
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    )
    await user.click(await screen.findByRole('option', { name: 'member' }))
    expect(workspaceApiMocks.changeMemberRole).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('allows demoting an owner when another owner remains', async () => {
    const user = userEvent.setup()
    mockConfirm(true)
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [members[0], { ...members[1], roleId: 'role-owner', roleName: 'owner' }],
    })
    workspaceApiMocks.listRoles.mockResolvedValue({
      data: [
        { builtIn: true, id: 'role-owner', memberCount: 2, name: 'owner' },
        { builtIn: true, id: 'role-member', memberCount: 0, name: 'member' },
      ],
    })
    await renderWorkspaceSettings(ownerId)
    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    )
    await user.click(await screen.findByRole('option', { name: 'member' }))

    await waitFor(() =>
      expect(workspaceApiMocks.changeMemberRole).toHaveBeenCalledWith(
        workspaceId,
        'membership-1',
        'role-member'
      )
    )
  })

  it('uses the active role to determine member management access', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        { ...members[0], roleName: 'member' },
        { ...members[1], roleName: 'owner' },
      ],
    })
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Cargo de Bia Member' })
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Remover Ana Owner' })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Convites' })).not.toBeInTheDocument()
  })

  it('does not open a removal dialog when the API does not support removal', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    const removeButton = await screen.findByRole('button', {
      name: 'Remover Bia Member',
    })
    await user.click(removeButton)

    expect(removeButton).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('guides a removed member to contact a workspace owner on access denial', async () => {
    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new ApiError('Acesso negado', 403)
    )
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByText(
        'Acesso ao workspace negado. Se você perdeu o vínculo, procure um dono.'
      )
    ).toBeInTheDocument()
  })

  it('shows a safe network message instead of raw member API details', async () => {
    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new ApiError(
        'Sensitive transport detail',
        undefined,
        undefined,
        undefined,
        {
          networkError: true,
        }
      )
    )
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByText('Não foi possível carregar os membros.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Sensitive transport detail')).toBeNull()
    expect(
      screen.getByRole('button', { name: retryButtonName })
    ).toBeInTheDocument()
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
