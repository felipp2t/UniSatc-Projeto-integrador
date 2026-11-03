// @vitest-environment happy-dom

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { WorkspacePermission } from '@/api/permissions'
import {
  apiMocks,
  collectionPage,
  folderAId,
  renderAt,
  workspaceId,
} from '@/test/workspace-browser-fixtures'

describe('workspace permission gates', () => {
  function grant(permissions: WorkspacePermission[]) {
    apiMocks.workspacePermissions.mockResolvedValue({
      data: {
        isOwner: false,
        permissions,
        roleId: 'reader',
        roleName: 'Reader',
      },
    })
  }

  it('hides creation and folder mutations for a reader', async () => {
    grant([
      { action: 'read', resource: 'collection' },
      { action: 'read', resource: 'item' },
    ])
    apiMocks.collectionsList.mockResolvedValue(
      collectionPage([{ id: folderAId, name: 'Folder A', parentId: null }])
    )
    await renderAt('/')
    await screen.findByRole('link', { name: 'Folder A' })
    expect(screen.queryByRole('button', { name: 'Nova pasta' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Simulate item created' })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Ações de Folder A' })
    ).toBeNull()
  })

  it('does not fetch lists without read grants', async () => {
    grant([])
    await renderAt('/')
    await screen.findByRole('heading', { name: 'Workspace' })
    expect(apiMocks.itemsList).not.toHaveBeenCalled()
    expect(apiMocks.collectionsList).not.toHaveBeenCalled()
  })

  it('can create a root folder without permission to list folders', async () => {
    grant([{ action: 'create', resource: 'collection' }])
    const user = userEvent.setup()
    await renderAt('/')
    await user.click(await screen.findByRole('button', { name: 'Nova pasta' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'New' },
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar pasta' })
    )
    await waitFor(() =>
      expect(apiMocks.collectionsCreate).toHaveBeenCalledWith(workspaceId, {
        name: 'New',
        parentId: undefined,
      })
    )
    expect(apiMocks.collectionsList).not.toHaveBeenCalled()
  })

  it('blocks direct navigation to history without activity read', async () => {
    grant([])
    await renderAt('/atividades')
    expect(await screen.findByText('Página não encontrada')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Histórico de atividades' })
    ).toBeNull()
  })

  it('hides the history link without activity read', async () => {
    grant([])
    const user = userEvent.setup()
    await renderAt('/')
    await user.click(
      await screen.findByRole('button', { name: 'Ações do workspace' })
    )
    expect(
      screen.queryByRole('menuitem', { name: 'Histórico de atividades' })
    ).toBeNull()
  })
})
