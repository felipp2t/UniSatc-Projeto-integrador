// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { receivedContentApi } from '@/api/endpoints'
import { receivedContentKeys } from '@/api/workspace-keys'
import { renderWithProviders } from '@/test/render'
import { ReceivedContentTree } from '@/components/workspace/received-content-tree'

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    receivedContentApi: {
      ...actual.receivedContentApi,
      list: vi.fn(),
      read: vi.fn(),
    },
  }
})

afterEach(() => vi.resetAllMocks())
const receivedItemButtonName = /API (?:secret|text) Somente leitura/

describe('received content tree', () => {
  it('loads all pages and preserves same named entries with distinct received IDs', async () => {
    const entries = [
      {
        id: 'virtual-file-1',
        path: 'Projetos/Chaves/API',
        readOnly: true,
        received: true,
        sourceTeamName: 'Produto',
        title: 'API',
        type: 'secret' as const,
      },
      {
        id: 'virtual-file-2',
        path: 'Projetos/Chaves/API',
        readOnly: true,
        received: true,
        sourceTeamName: 'Produto',
        title: 'API',
        type: 'secret' as const,
      },
    ]
    vi.mocked(receivedContentApi.list)
      .mockResolvedValueOnce({
        data: {
          items: [entries[0]],
          page: 0,
          size: 1,
          totalItems: 2,
          totalPages: 2,
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          items: [entries[1]],
          page: 1,
          size: 1,
          totalItems: 2,
          totalPages: 2,
        },
      } as never)
    const user = userEvent.setup()
    renderWithProviders(<ReceivedContentTree workspaceId='workspace-1' />)

    const team = await screen.findByText('Produto')
    await user.click(team.closest('summary') as HTMLElement)
    const project = screen.getByText('Projetos')
    await user.click(project.closest('summary') as HTMLElement)
    const folder = screen.getByText('Chaves')
    await user.click(folder.closest('summary') as HTMLElement)

    expect(
      await screen.findAllByRole('button', {
        name: receivedItemButtonName,
      })
    ).toHaveLength(2)
    expect(receivedContentApi.list).toHaveBeenCalledTimes(2)
    expect(receivedContentApi.list).toHaveBeenNthCalledWith(
      2,
      'workspace-1',
      { page: 1, size: 100 },
      expect.any(AbortSignal)
    )
  })

  it('clears previously loaded content when access is revoked on refetch', async () => {
    vi.mocked(receivedContentApi.list).mockResolvedValue({
      data: {
        items: [
          {
            id: 'virtual-secret',
            path: 'Credenciais/API',
            readOnly: true,
            received: true,
            sourceTeamName: 'Produto',
            textContent: 'conteúdo confidencial anterior',
            title: 'Notas do projeto',
            type: 'text',
          },
        ],
        page: 0,
        size: 100,
        totalItems: 1,
        totalPages: 1,
      },
    } as never)
    vi.mocked(receivedContentApi.read)
      .mockResolvedValueOnce({
        data: {
          id: 'virtual-secret',
          textContent: 'conteúdo confidencial anterior',
          title: 'Notas do projeto',
          type: 'text',
        },
      } as never)
      .mockRejectedValueOnce(new Error('revoked'))
    const user = userEvent.setup()
    const { queryClient } = renderWithProviders(
      <ReceivedContentTree workspaceId='workspace-1' />
    )

    await user.click(
      await screen
        .findByText('Produto')
        .then((node) => node.closest('summary') as HTMLElement)
    )
    await user.click(
      screen.getByText('Credenciais').closest('summary') as HTMLElement
    )
    await user.click(
      screen.getByRole('button', { name: receivedItemButtonName })
    )

    expect(
      await screen.findByText('conteúdo confidencial anterior')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(receivedContentApi.read).toHaveBeenCalledWith(
        'workspace-1',
        'virtual-secret'
      )
    )
    await waitFor(() =>
      expect(receivedContentApi.read).toHaveBeenCalledTimes(1)
    )

    await queryClient.invalidateQueries({
      queryKey: receivedContentKeys.detail('workspace-1', 'virtual-secret'),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este conteúdo não está mais disponível.'
    )
    expect(screen.queryByText('conteúdo confidencial anterior')).toBeNull()
  })
})
