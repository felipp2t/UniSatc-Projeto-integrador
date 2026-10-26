// @vitest-environment happy-dom

import { render, screen, within } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../test/dom-setup'
import { FolderCard } from './folder-card'
import { ItemCard } from './item-card'
import { WorkspaceCard } from './workspace-card'

const rejected = () => Promise.reject(new Error('Falha na operação'))

async function openFolderDeleteDialog({
  error,
  onDelete,
}: {
  error?: string
  onDelete: () => Promise<void>
}) {
  const user = userEvent.setup({
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  })
  render(
    <FolderCard
      error={error}
      folderId='folder-1'
      itemCount={0}
      name='Folder'
      onDelete={onDelete}
      subfolderCount={0}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Excluir' }))
  const dialog = await screen.findByRole('dialog')
  return { dialog, user }
}

describe('card operation errors', () => {
  it('shows workspace delete errors as alerts without retry', async () => {
    const user = userEvent.setup()
    render(
      <WorkspaceCard
        onDelete={rejected}
        workspace={{ id: 'workspace-1', name: 'Workspace' }}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na operação'
    )
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' })
    ).toBeNull()
  })

  it('shows folder delete errors as alerts', async () => {
    const { dialog, user } = await openFolderDeleteDialog({
      onDelete: rejected,
    })
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Falha na operação'
    )
    expect(screen.getAllByRole('alert', { hidden: true })).toHaveLength(1)
  })

  it('moves a folder error to the card after cancelling', async () => {
    const { dialog, user } = await openFolderDeleteDialog({
      onDelete: rejected,
    })
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    await within(dialog).findByRole('alert')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na operação'
    )
  })

  it('shows prop errors inside the open folder dialog without duplication', async () => {
    const { dialog } = await openFolderDeleteDialog({
      error: 'Erro externo',
      onDelete: vi.fn(),
    })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Erro externo'
    )
    expect(screen.getAllByRole('alert', { hidden: true })).toHaveLength(1)
  })

  it('closes the folder dialog after a successful deletion', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const { dialog, user } = await openFolderDeleteDialog({ onDelete })
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onDelete).toHaveBeenCalledWith('folder-1')
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull()
  })

  it('shows item delete errors as alerts', async () => {
    const user = userEvent.setup()
    const props = {
      item: { id: 'item-1', title: 'Item', type: 'text' as const },
      onDelete: vi.fn(rejected),
    }
    render(<ItemCard {...props} />)
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na operação'
    )
  })

  it('shows item archive errors as alerts', async () => {
    const user = userEvent.setup()
    render(
      <ItemCard
        item={{ id: 'item-1', title: 'Item', type: 'text' }}
        onArchive={vi.fn(rejected)}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Arquivar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na operação'
    )
  })

  it('shows item restore errors as alerts', async () => {
    const user = userEvent.setup()
    render(
      <ItemCard
        item={{
          archivedAt: '2026-01-01',
          id: 'item-1',
          title: 'Item',
          type: 'text',
        }}
        onRestore={rejected}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Restaurar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na operação'
    )
  })
})
