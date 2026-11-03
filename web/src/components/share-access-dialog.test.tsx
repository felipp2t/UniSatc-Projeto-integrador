// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { accessGroupApi, sharingApi, workspaceApi } from '@/api/endpoints'
import { renderWithProviders } from '@/test/render'
import { ShareAccessDialog } from './share-access-dialog'

vi.mock('@/api/endpoints', () => ({
  accessGroupApi: { list: vi.fn() },
  sharingApi: { origins: vi.fn() },
  workspaceApi: { permissions: vi.fn() },
}))

afterEach(() => vi.resetAllMocks())

function renderDialog(permissions: { resource: string; action: string }[]) {
  vi.mocked(workspaceApi.permissions).mockResolvedValue({
    data: {
      isOwner: false,
      permissions,
      roleId: 'role-1',
      roleName: 'Member',
    },
  } as never)
  vi.mocked(sharingApi.origins).mockResolvedValue({ data: [] } as never)
  vi.mocked(accessGroupApi.list).mockResolvedValue({ data: [] } as never)
  renderWithProviders(
    <ShareAccessDialog
      onClose={vi.fn()}
      open
      target={{ id: 'folder-1', kind: 'collection', name: 'Folder' }}
      workspaceId='workspace-1'
    />
  )
}

describe('sharing permission gates', () => {
  it('does not load sharing controls without sharing manage', async () => {
    renderDialog([])
    expect(
      await screen.findByText(
        'Você não tem permissão para gerenciar o compartilhamento deste conteúdo.'
      )
    ).toBeInTheDocument()
    expect(sharingApi.origins).not.toHaveBeenCalled()
    expect(accessGroupApi.list).not.toHaveBeenCalled()
  })

  it('allows public sharing without requesting groups the member cannot manage', async () => {
    renderDialog([{ action: 'manage', resource: 'sharing' }])
    expect(
      await screen.findByRole('button', { name: 'Conceder acesso a todos' })
    ).toBeEnabled()
    await waitFor(() => expect(sharingApi.origins).toHaveBeenCalledOnce())
    expect(accessGroupApi.list).not.toHaveBeenCalled()
    expect(screen.queryByText('Grupos de acesso')).toBeNull()
  })
})
