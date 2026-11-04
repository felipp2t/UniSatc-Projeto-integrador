// @vitest-environment happy-dom

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import {
  members,
  ownerId,
  renderWorkspaceSettings,
  setupWorkspaceSettingsMocks,
  workspaceId,
} from '@/test/workspace-settings-fixtures'
import {
  toastSuccess,
  workspaceApiMocks,
} from '@/test/workspace-settings-mocks'

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  const shared = await import('@/test/workspace-settings-mocks')
  return {
    ...actual,
    appToast: {
      ...actual.appToast,
      error: shared.toastError,
      success: shared.toastSuccess,
    },
  }
})

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  const shared = await import('@/test/workspace-settings-mocks')
  return {
    ...actual,
    inviteApi: {
      ...actual.inviteApi,
      create: shared.inviteApiMocks.create,
      list: shared.inviteApiMocks.list,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      changeMemberRole: shared.workspaceApiMocks.changeMemberRole,
      list: shared.workspaceApiMocks.list,
      listMembers: shared.workspaceApiMocks.listMembers,
      listRoles: shared.workspaceApiMocks.listRoles,
      removeMember: shared.workspaceApiMocks.removeMember,
    },
  }
})

beforeEach(setupWorkspaceSettingsMocks)

afterEach(() => vi.restoreAllMocks())

const removingButtonName = /Removendo/

describe('workspace member removal', () => {
  const removeConfirmName = 'Remover membro'
  const thirdMember = {
    email: 'caio@example.com',
    id: 'membership-3',
    name: 'Caio Member',
    roleId: 'role-member',
    roleName: 'Member',
    userId: 'member-3',
  }

  async function openRemoval(
    user: ReturnType<typeof userEvent.setup>,
    memberName: string
  ) {
    await user.click(
      await screen.findByRole('button', { name: `Remover ${memberName}` })
    )
    return await screen.findByRole('dialog')
  }

  it.each([
    [
      400,
      'A confirmação do membro é inválida. Feche e abra a confirmação novamente.',
    ],
    [403, 'Você não tem permissão para remover este membro.'],
    [404, 'Este membro não está mais no workspace. Atualize a lista.'],
    [409, 'O último dono do workspace não pode ser removido.'],
  ])(
    'shows the exact message for status %i and keeps the dialog open',
    async (status, message) => {
      const user = userEvent.setup()
      workspaceApiMocks.removeMember.mockRejectedValueOnce(
        new ApiError('Sensitive server detail', status)
      )
      await renderWorkspaceSettings(ownerId)

      const dialog = await openRemoval(user, 'Bia Member')
      await user.click(
        within(dialog).getByRole('button', { name: removeConfirmName })
      )

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        message
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText('Sensitive server detail')).toBeNull()
      expect(toastSuccess).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['500', new ApiError('Sensitive server detail', 500)],
    ['generic', new Error('Sensitive server detail')],
  ])(
    'uses a safe fallback for a %s error without leaking details',
    async (_label, error) => {
      const user = userEvent.setup()
      workspaceApiMocks.removeMember.mockRejectedValueOnce(error)
      await renderWorkspaceSettings(ownerId)

      const dialog = await openRemoval(user, 'Bia Member')
      await user.click(
        within(dialog).getByRole('button', { name: removeConfirmName })
      )

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Não foi possível remover o membro. Tente novamente.'
      )
      expect(screen.queryByText('Sensitive server detail')).toBeNull()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    }
  )

  it('blocks cancel, confirm and Escape while the removal is pending', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.removeMember.mockReturnValue(new Promise(() => undefined))
    await renderWorkspaceSettings(ownerId)

    const dialog = await openRemoval(user, 'Bia Member')
    await user.click(
      within(dialog).getByRole('button', { name: removeConfirmName })
    )

    const cancelButton = await within(dialog).findByRole('button', {
      name: 'Cancelar',
    })
    await waitFor(() => expect(cancelButton).toBeDisabled())
    expect(
      within(dialog).getByRole('button', { name: removingButtonName })
    ).toBeDisabled()
    const otherMemberButton = screen.getByLabelText('Remover Ana Owner')
    expect(otherMemberButton).toBeDisabled()

    fireEvent.click(otherMemberButton)
    expect(workspaceApiMocks.removeMember).toHaveBeenCalledOnce()

    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(workspaceApiMocks.removeMember).toHaveBeenCalledOnce()
  })

  it('clears the error when closing and reopening for another member', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [...members, thirdMember],
    })
    workspaceApiMocks.removeMember.mockRejectedValueOnce(
      new ApiError('Sensitive server detail', 403)
    )
    await renderWorkspaceSettings(ownerId)

    const dialog = await openRemoval(user, 'Bia Member')
    await user.click(
      within(dialog).getByRole('button', { name: removeConfirmName })
    )
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const reopened = await openRemoval(user, 'Caio Member')

    expect(reopened).toHaveTextContent('Caio Member (caio@example.com)')
    expect(within(reopened).queryByRole('alert')).toBeNull()
  })

  it('removes another member with the membership ID, closes the dialog and refetches', async () => {
    const user = userEvent.setup()
    const { router, session } = await renderWorkspaceSettings(ownerId)
    const dialog = await openRemoval(user, 'Bia Member')
    workspaceApiMocks.listMembers.mockResolvedValue({ data: [members[0]] })
    await user.click(
      within(dialog).getByRole('button', { name: removeConfirmName })
    )

    await waitFor(() =>
      expect(workspaceApiMocks.removeMember).toHaveBeenCalledWith(
        workspaceId,
        'membership-2'
      )
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(toastSuccess).toHaveBeenCalledWith(
      'Membro removido. A conta e o conteúdo permanecem preservados.'
    )
    await waitFor(() =>
      expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(2)
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remover Bia Member' })
      ).toBeNull()
    )
    expect(session.clearLocalSession).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/configuracoes-workspace')
  })

  it('ends the session, clears the cache and goes to login when removing yourself', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        members[0],
        { ...members[1], roleId: 'role-owner', roleName: 'Owner' },
      ],
    })
    const { queryClient, router, session } =
      await renderWorkspaceSettings(ownerId)
    const clearSpy = vi.spyOn(queryClient, 'clear')

    const dialog = await openRemoval(user, 'Ana Owner')
    await user.click(
      within(dialog).getByRole('button', { name: removeConfirmName })
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(workspaceApiMocks.removeMember).toHaveBeenCalledWith(
      workspaceId,
      'membership-1'
    )
    expect(session.clearLocalSession).toHaveBeenCalledOnce()
    expect(clearSpy).toHaveBeenCalledOnce()
    expect(toastSuccess).toHaveBeenCalledOnce()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(1)
    expect(workspaceApiMocks.list).toHaveBeenCalledTimes(1)
    expect(workspaceApiMocks.listRoles).toHaveBeenCalledTimes(1)
  })

  it('shows the error immediately even while the members refetch is pending', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)
    workspaceApiMocks.removeMember.mockRejectedValueOnce(
      new ApiError('Sensitive server detail', 403)
    )
    const dialog = await openRemoval(user, 'Bia Member')
    workspaceApiMocks.listMembers.mockReturnValue(new Promise(() => undefined))
    await user.click(
      within(dialog).getByRole('button', { name: removeConfirmName })
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para remover este membro.'
    )
    await waitFor(() =>
      expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(2)
    )
    expect(
      within(dialog).queryByRole('button', { name: removingButtonName })
    ).toBeNull()
    expect(
      within(dialog).getByRole('button', { name: removeConfirmName })
    ).toBeEnabled()
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' })
    ).toBeEnabled()
  })

  it('refetches members after a 404 so the stale row disappears', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)
    workspaceApiMocks.removeMember.mockRejectedValueOnce(
      new ApiError('Not found', 404)
    )
    const dialog = await openRemoval(user, 'Bia Member')
    workspaceApiMocks.listMembers.mockResolvedValue({ data: [members[0]] })
    await user.click(
      within(dialog).getByRole('button', { name: removeConfirmName })
    )

    await waitFor(() =>
      expect(workspaceApiMocks.listMembers).toHaveBeenCalledTimes(2)
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Remover Bia Member' })
      ).toBeNull()
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Este membro não está mais no workspace. Atualize a lista.'
    )
  })
})
