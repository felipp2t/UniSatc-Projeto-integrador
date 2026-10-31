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
const toastError = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return {
    ...actual,
    appToast: {
      ...actual.appToast,
      error: toastError,
      success: toastSuccess,
    },
  }
})

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
const roleSelectName = /^Cargo de/
const removeButtonName = /^Remover/
const members = [
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

const selfDemotionWarning =
  'Você perderá o acesso de gestão de membros deste workspace.'
const coOwners = [
  members[0],
  { ...members[1], roleId: 'role-owner', roleName: 'Owner' },
]

function createSession(userId: string): SessionService {
  return createSessionStub({
    status: 'authenticated',
    user: { email: 'user@example.com', id: userId, name: 'User' },
  })
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
      { id: 'role-owner', name: 'Owner' },
      { id: 'role-member', name: 'Member' },
    ],
  })
  workspaceApiMocks.changeMemberRole.mockResolvedValue({ data: members[1] })
  inviteApiMocks.create.mockResolvedValue(undefined)
  inviteApiMocks.list.mockResolvedValue({ data: [] })
  toastError.mockReset()
  toastSuccess.mockReset()
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
    await user.click(await screen.findByRole('option', { name: 'Owner' }))
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
    expect(screen.getByText('Member')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remover Bia Member' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Cargo de Bia Member' })
    ).not.toBeInTheDocument()
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
    expect(
      await screen.findByRole('option', { name: 'Member' })
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Owner' })).toBeInTheDocument()
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

  it('shows the member role while the role catalog is loading', async () => {
    let resolveRoles: (value: {
      data: { id: string; name: string }[]
    }) => void = () => undefined
    workspaceApiMocks.listRoles.mockReturnValue(
      new Promise((resolve) => {
        resolveRoles = resolve
      })
    )
    await renderWorkspaceSettings(ownerId)

    const roleSelector = await screen.findByRole('combobox', {
      name: 'Cargo de Bia Member',
    })
    expect(roleSelector).toBeDisabled()
    expect(roleSelector).toHaveTextContent('Member')

    resolveRoles({
      data: [
        { id: 'role-member', name: 'Member' },
        { id: 'role-owner', name: 'Owner' },
      ],
    })
    await waitFor(() => expect(roleSelector).toBeEnabled())
  })

  it('confirms and changes a member role using the membership ID', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Owner' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'Alterar o cargo de Bia Member para Owner?'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
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
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Owner' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(workspaceApiMocks.changeMemberRole).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('demotes a co-owner when two owners exist', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        members[0],
        { ...members[1], roleId: 'role-owner', roleName: 'Owner' },
      ],
    })
    workspaceApiMocks.listRoles.mockResolvedValue({
      data: [
        { id: 'role-owner', name: 'Owner' },
        { id: 'role-member', name: 'Member' },
      ],
    })
    await renderWorkspaceSettings(ownerId)
    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    )
    await user.click(await screen.findByRole('option', { name: 'Member' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'Alterar o cargo de Ana Owner para Member?'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(workspaceApiMocks.changeMemberRole).toHaveBeenCalledWith(
        workspaceId,
        'membership-1',
        'role-member'
      )
    )
    expect(toastSuccess).toHaveBeenCalledWith('Cargo alterado com sucesso.')
  })

  it('treats a creator with a non-Owner role as a regular member', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        { ...members[0], roleId: 'role-member', roleName: 'Member' },
        { ...members[1], roleId: 'role-owner', roleName: 'Owner' },
      ],
    })
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('tab', { name: 'Membros (2)' })
    ).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Convites' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Cargo de Bia Member' })
    ).not.toBeInTheDocument()
  })

  it('allows a co-owner to manage members after the creator is demoted', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        { ...members[0], roleId: 'role-member', roleName: 'Member' },
        { ...members[1], roleId: 'role-owner', roleName: 'Owner' },
      ],
    })
    workspaceApiMocks.listRoles.mockResolvedValue({
      data: [
        { id: 'role-owner', name: 'Owner' },
        { id: 'role-member', name: 'Member' },
      ],
    })
    await renderWorkspaceSettings('member-2')

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Convites' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Cargo de Ana Owner' })
      ).toBeEnabled()
    )
  })

  it('does not authorize the lower-case owner role', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [{ ...members[0], roleName: 'owner' }, members[1]],
    })
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('tab', { name: 'Membros (2)' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Convites' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Cargo de Bia Member' })
    ).not.toBeInTheDocument()
  })

  it('shows a safe message when the server rejects a last-owner demotion', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        members[0],
        { ...members[1], roleId: 'role-owner', roleName: 'Owner' },
      ],
    })
    workspaceApiMocks.listRoles.mockResolvedValue({
      data: [
        { id: 'role-owner', name: 'Owner' },
        { id: 'role-member', name: 'Member' },
      ],
    })
    workspaceApiMocks.changeMemberRole.mockRejectedValueOnce(
      new ApiError('Sensitive server detail', 409)
    )
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    )
    await user.click(await screen.findByRole('option', { name: 'Member' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(workspaceApiMocks.changeMemberRole).toHaveBeenCalledWith(
        workspaceId,
        'membership-1',
        'role-member'
      )
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'O servidor recusou a alteração para proteger o último dono do workspace.'
      )
    )
    expect(toastError).not.toHaveBeenCalledWith('Sensitive server detail')
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

  it('disables the role selector of the only Owner and never sends a change', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    const memberSelect = await screen.findByRole('combobox', {
      name: 'Cargo de Bia Member',
    })
    await waitFor(() => expect(memberSelect).toBeEnabled())
    const ownerSelect = screen.getByRole('combobox', {
      name: 'Cargo de Ana Owner',
    })
    expect(ownerSelect).toBeDisabled()
    expect(ownerSelect).toHaveTextContent('Owner')

    await user.click(ownerSelect)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(workspaceApiMocks.changeMemberRole).not.toHaveBeenCalled()
  })

  it('enables the role selector of every Owner when there are two Owners', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({ data: coOwners })
    await renderWorkspaceSettings(ownerId)

    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Cargo de Ana Owner' })
      ).toBeEnabled()
    )
    expect(
      screen.getByRole('combobox', { name: 'Cargo de Bia Member' })
    ).toBeEnabled()
  })

  it('lets an owner demote themselves, then shows the non-owner view after refetch', async () => {
    const user = userEvent.setup()
    let current = coOwners
    workspaceApiMocks.listMembers.mockImplementation(() =>
      Promise.resolve({ data: current })
    )
    workspaceApiMocks.changeMemberRole.mockImplementation(() => {
      current = [
        { ...members[0], roleId: 'role-member', roleName: 'Member' },
        coOwners[1],
      ]
      return Promise.resolve({ data: current[0] })
    })
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Ana Owner' })
    )
    await user.click(await screen.findByRole('option', { name: 'Member' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(selfDemotionWarning)
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(workspaceApiMocks.changeMemberRole).toHaveBeenCalledWith(
        workspaceId,
        'membership-1',
        'role-member'
      )
    )
    await waitFor(() =>
      expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument()
    )
    expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('combobox', { name: roleSelectName })).toBeNull()
    expect(screen.queryByText('bia@example.com')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Convites' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: removeButtonName })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Ana Owner')).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith('Cargo alterado com sucesso.')
  })

  it('disables the role selectors while a role change is pending', async () => {
    const user = userEvent.setup()
    let resolveChange: (value: unknown) => void = () => undefined
    workspaceApiMocks.changeMemberRole.mockReturnValue(
      new Promise((resolve) => {
        resolveChange = resolve
      })
    )
    workspaceApiMocks.listMembers.mockResolvedValue({ data: coOwners })
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Member' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Cargo de Bia Member' })
      ).toBeDisabled()
    )
    expect(
      screen.getByRole('combobox', { name: 'Cargo de Ana Owner' })
    ).toBeDisabled()
    expect(workspaceApiMocks.changeMemberRole).toHaveBeenCalledOnce()

    resolveChange({ data: members[1] })
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Cargo de Bia Member' })
      ).toBeEnabled()
    )
  })

  it.each([403, 404, 409])(
    'refetches members after a %i error changing a role',
    async (status) => {
      const user = userEvent.setup()
      workspaceApiMocks.listMembers.mockResolvedValue({ data: coOwners })
      workspaceApiMocks.changeMemberRole.mockRejectedValueOnce(
        new ApiError('Server detail', status)
      )
      await renderWorkspaceSettings(ownerId)

      await user.click(
        await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
      )
      await user.click(await screen.findByRole('option', { name: 'Member' }))
      const dialog = await screen.findByRole('dialog')
      await waitFor(() =>
        expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(1)
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Confirmar' })
      )

      await waitFor(() => expect(toastError).toHaveBeenCalledOnce())
      await waitFor(() =>
        expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(2)
      )
      expect(toastSuccess).not.toHaveBeenCalled()
    }
  )

  it('refetches members after a successful role change', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Owner' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(2)
    )
  })

  it('warns about losing management only when an owner demotes themselves', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listMembers.mockResolvedValue({ data: coOwners })
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Member' }))
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'Alterar o cargo de Bia Member para Member?'
    )
    expect(dialog).not.toHaveTextContent(selfDemotionWarning)
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    await user.click(
      screen.getByRole('combobox', { name: 'Cargo de Ana Owner' })
    )
    await user.click(await screen.findByRole('option', { name: 'Member' }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'Alterar o cargo de Ana Owner para Member?'
    )
    expect(dialog).toHaveTextContent(selfDemotionWarning)
  })

  it('does not warn when promoting another member', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Owner' }))
    const dialog = await screen.findByRole('dialog')

    expect(dialog).toHaveTextContent(
      'Alterar o cargo de Bia Member para Owner?'
    )
    expect(dialog).not.toHaveTextContent(selfDemotionWarning)
  })
})

describe('workspace roles load error banner', () => {
  const rolesErrorMessage = 'Não foi possível carregar os cargos.'

  it('shows the banner to the owner, keeps selects disabled and recovers on reload', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listRoles.mockRejectedValueOnce(
      new Error('Request failed')
    )
    await renderWorkspaceSettings(ownerId)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      rolesErrorMessage
    )
    const selects = await screen.findAllByRole('combobox', {
      name: roleSelectName,
    })
    expect(selects.length).toBeGreaterThan(0)
    for (const select of selects) {
      expect(select).toBeDisabled()
    }
    expect(workspaceApiMocks.listRoles).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Recarregar cargos' }))

    await waitFor(() => {
      expect(workspaceApiMocks.listRoles).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.queryByText(rolesErrorMessage)).not.toBeInTheDocument()
    })
    expect(
      await screen.findByRole('combobox', { name: 'Cargo de Bia Member' })
    ).toBeEnabled()
  })

  it('never shows the banner to non-owners nor requests roles', async () => {
    workspaceApiMocks.listRoles.mockRejectedValue(new Error('Request failed'))
    await renderWorkspaceSettings('member-2')

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(screen.queryByText(rolesErrorMessage)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Recarregar cargos' })
    ).not.toBeInTheDocument()
    expect(workspaceApiMocks.listRoles).not.toHaveBeenCalled()
  })

  it('does not request roles nor show the banner for an empty member list', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({ data: [] })
    await renderWorkspaceSettings(ownerId)

    expect(await screen.findByText('Nenhum membro encontrado')).toBeVisible()
    expect(screen.queryByText(rolesErrorMessage)).not.toBeInTheDocument()
    expect(workspaceApiMocks.listRoles).not.toHaveBeenCalled()
  })

  it('does not show the banner when the filtered list is empty', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listRoles.mockRejectedValue(new Error('Request failed'))
    await renderWorkspaceSettings(ownerId)
    expect(await screen.findByText(rolesErrorMessage)).toBeInTheDocument()

    await user.type(
      screen.getByRole('textbox', { name: 'Buscar membro por nome' }),
      'Ninguém'
    )

    expect(await screen.findByText('Nenhum resultado')).toBeInTheDocument()
    expect(screen.queryByText(rolesErrorMessage)).not.toBeInTheDocument()
  })

  it('hides the banner when the members request fails', async () => {
    workspaceApiMocks.listRoles.mockRejectedValue(new Error('Request failed'))
    const { queryClient } = await renderWorkspaceSettings(ownerId)
    expect(await screen.findByText(rolesErrorMessage)).toBeInTheDocument()

    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new Error('Request failed')
    )
    await queryClient.invalidateQueries({
      queryKey: ['workspace-members', workspaceId],
    })

    expect(
      await screen.findByText('Não foi possível carregar os membros.')
    ).toBeInTheDocument()
    expect(screen.queryByText(rolesErrorMessage)).not.toBeInTheDocument()
  })
})
