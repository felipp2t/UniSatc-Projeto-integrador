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
import { workspaceApiMocks } from '@/test/workspace-settings-mocks'

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  const shared = await import('@/test/workspace-settings-mocks')
  return {
    ...actual,
    globalRoleApi: {
      ...actual.globalRoleApi,
      assign: shared.workspaceApiMocks.assignGlobalRole,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      list: shared.workspaceApiMocks.list,
      listMembers: shared.workspaceApiMocks.listMembers,
      permissions: shared.workspaceApiMocks.permissions,
      transferOwnership: shared.workspaceApiMocks.transferOwnership,
    },
  }
})

beforeEach(setupWorkspaceSettingsMocks)
afterEach(() => vi.restoreAllMocks())

describe('fixed global workspace roles', () => {
  it('shows only the owner controls and assigns Admin to another member', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Papel global de Bia Member' })
    ).toHaveTextContent('Sem papel global')
    expect(
      screen.queryByRole('combobox', { name: 'Papel global de Ana Owner' })
    ).toBeNull()

    await user.click(
      screen.getByRole('combobox', { name: 'Papel global de Bia Member' })
    )
    await user.click(await screen.findByRole('option', { name: 'Admin' }))

    await waitFor(() =>
      expect(workspaceApiMocks.assignGlobalRole).toHaveBeenCalledWith(
        workspaceId,
        members[1].id,
        'ADMIN'
      )
    )
  })

  it('requires confirmation before transferring ownership', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId)

    await user.click(
      await screen.findByRole('button', {
        name: 'Transferir propriedade para Bia Member',
      })
    )
    expect(
      await screen.findByText(
        'Bia Member será o novo dono. Você passará a ser administrador.'
      )
    ).toBeInTheDocument()
    expect(workspaceApiMocks.transferOwnership).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Transferir propriedade' })
    )

    await waitFor(() =>
      expect(workspaceApiMocks.transferOwnership).toHaveBeenCalledWith(
        workspaceId,
        members[1].id
      )
    )
  })
})
