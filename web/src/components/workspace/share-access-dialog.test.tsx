// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectionsApi,
  publicationApi,
  workspaceApi,
  workspaceTeamsApi,
} from '@/api/endpoints'
import { renderWithProviders } from '@/test/render'
import { ShareAccessDialog } from '@/components/workspace/share-access-dialog'

vi.mock('@/api/endpoints', () => ({
  collectionsApi: { path: vi.fn() },
  publicationApi: {
    configuration: vi.fn(),
    publish: vi.fn(),
    revoke: vi.fn(),
  },
  workspaceApi: { permissions: vi.fn() },
  workspaceTeamsApi: { list: vi.fn() },
}))

afterEach(() => vi.resetAllMocks())

function renderDialog({ isOwner = false, isTeamLeader = false } = {}) {
  vi.mocked(workspaceApi.permissions).mockResolvedValue({
    data: {
      globalRole: null,
      isOwner,
      isTeamLeader,
      permissions: [],
      roleName: 'Member',
      teamId: null,
    },
  } as never)
  vi.mocked(collectionsApi.path).mockResolvedValue({
    data: [{ id: 'source-collection', name: 'Folder' }],
  } as never)
  vi.mocked(publicationApi.configuration).mockResolvedValue({
    data: {
      destinationTeams: [
        { collectionId: 'team-root', id: 'team-1', name: 'Produto' },
      ],
      publications: [],
      sourceCollectionId: 'source-collection',
    },
  } as never)
  vi.mocked(workspaceTeamsApi.list).mockResolvedValue({ data: [] } as never)
  vi.mocked(publicationApi.publish).mockResolvedValue({ data: {} } as never)
  vi.mocked(publicationApi.revoke).mockResolvedValue(undefined as never)
  const user = userEvent.setup()
  renderWithProviders(
    <ShareAccessDialog
      onClose={vi.fn()}
      open
      target={{ id: 'source-collection', kind: 'collection', name: 'Folder' }}
      workspaceId='workspace-1'
    />
  )
  return user
}

describe('publication controls', () => {
  it('lets a team leader publish to an available destination team', async () => {
    const user = renderDialog({ isTeamLeader: true })

    await user.click(
      await screen.findByRole('combobox', { name: 'Time destinatário' })
    )
    await user.click(await screen.findByRole('option', { name: 'Produto' }))
    await user.click(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() =>
      expect(publicationApi.publish).toHaveBeenCalledWith('workspace-1', {
        destinationTeamId: 'team-1',
        originalId: 'source-collection',
        originalType: 'COLLECTION',
      })
    )
  })

  it('does not offer publication to a member without team leadership', async () => {
    renderDialog()

    expect(
      await screen.findByText('Este conteúdo ainda não foi publicado.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull()
    expect(publicationApi.publish).not.toHaveBeenCalled()
  })

  it('lets the owner revoke an active publication after confirmation', async () => {
    const user = renderDialog({ isOwner: true })
    vi.mocked(publicationApi.configuration).mockResolvedValueOnce({
      data: {
        destinationTeams: [],
        publications: [
          {
            capturedPath: 'Folder/Secret',
            createdAt: '2026-11-05T10:00:00Z',
            destinationCollectionId: 'team-root',
            id: 'publication-1',
            originalId: 'source-collection',
            originalType: 'COLLECTION',
            sourceCollectionId: 'source-collection',
            sourceTeamName: 'Financeiro',
          },
        ],
        sourceCollectionId: 'source-collection',
      },
    } as never)

    await user.click(await screen.findByRole('button', { name: 'Revogar' }))
    await user.click(
      screen.getByRole('button', { name: 'Confirmar revogação' })
    )

    await waitFor(() =>
      expect(publicationApi.revoke).toHaveBeenCalledWith(
        'workspace-1',
        'publication-1'
      )
    )
  })
})
