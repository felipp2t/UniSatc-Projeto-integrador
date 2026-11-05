// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  members,
  ownerId,
  renderWorkspaceSettings,
  setupWorkspaceSettingsMocks,
  workspaceId,
} from '@/test/workspace-settings-fixtures'
import {
  inviteApiMocks,
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
    globalRoleApi: {
      ...actual.globalRoleApi,
      assign: shared.workspaceApiMocks.assignGlobalRole,
    },
    inviteApi: {
      ...actual.inviteApi,
      create: shared.inviteApiMocks.create,
      list: shared.inviteApiMocks.list,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      list: shared.workspaceApiMocks.list,
      listMembers: shared.workspaceApiMocks.listMembers,
      permissions: shared.workspaceApiMocks.permissions,
      removeMember: shared.workspaceApiMocks.removeMember,
      transferOwnership: shared.workspaceApiMocks.transferOwnership,
    },
  }
})

beforeEach(setupWorkspaceSettingsMocks)
afterEach(() => vi.restoreAllMocks())
const invitesTabName = /Convites/
const transferButtonName = /Transferir propriedade/
const globalRoleLabel = /Papel global/

describe('workspace members settings with fixed roles', () => {
  it('shows member identity, team role and filters by name', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(screen.getByText('Bia Member')).toBeInTheDocument()
    expect(workspaceApiMocks.listMembers).toHaveBeenCalledWith(workspaceId)

    await user.type(
      screen.getByRole('textbox', { name: 'Buscar membro por nome' }),
      'Bia'
    )
    expect(screen.getByText('Bia Member')).toBeInTheDocument()
    expect(screen.queryByText('Ana Owner')).toBeNull()
  })

  it('lets the owner invite members and only loads pending invites when opened', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    expect(
      await screen.findByRole('button', { name: 'Convidar' })
    ).toBeInTheDocument()
    expect(inviteApiMocks.list).not.toHaveBeenCalled()
    await user.click(screen.getByRole('tab', { name: invitesTabName }))
    await waitFor(() => expect(inviteApiMocks.list).toHaveBeenCalledOnce())
  })

  it('shows Admin and Maintainer labels as global roles', async () => {
    workspaceApiMocks.listMembers.mockResolvedValue({
      data: [
        members[0],
        { ...members[1], globalRole: 'ADMIN', roleName: 'Admin' },
        {
          ...members[1],
          globalRole: 'MAINTAINER',
          id: 'membership-3',
          roleName: 'Maintainer',
          userId: 'member-3',
        },
      ],
    })
    await renderWorkspaceSettings(ownerId)

    expect(await screen.findAllByText('Admin')).toHaveLength(2)
    expect(await screen.findAllByText('Maintainer')).toHaveLength(2)
  })

  it('hides owner controls from a regular member', async () => {
    workspaceApiMocks.permissions.mockResolvedValue({
      data: {
        globalRole: null,
        isOwner: false,
        isTeamLeader: false,
        permissions: [],
        roleName: 'Member',
        teamId: null,
      },
    })
    await renderWorkspaceSettings(members[1].userId)

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: invitesTabName })).toBeNull()
    expect(
      screen.queryByRole('button', { name: transferButtonName })
    ).toBeNull()
    expect(screen.queryByRole('combobox', { name: globalRoleLabel })).toBeNull()
  })
})
