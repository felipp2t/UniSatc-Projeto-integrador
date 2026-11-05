// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectionKeys } from '@/api/collection-keys'
import { ApiError } from '@/api/errors'
import type { ItemResponse, ItemSearchParams } from '@/api/types'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  downloadAttachment: vi.fn(),
  get: vi.fn(),
  listWorkspaces: vi.fn(),
  path: vi.fn(),
  permissions: vi.fn(),
  received: vi.fn(),
  search: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: { ...actual.collectionsApi, path: apiMocks.path },
    itemsApi: {
      ...actual.itemsApi,
      downloadAttachment: apiMocks.downloadAttachment,
      get: apiMocks.get,
      search: apiMocks.search,
    },
    receivedContentApi: {
      ...actual.receivedContentApi,
      list: apiMocks.received,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      list: apiMocks.listWorkspaces,
      permissions: apiMocks.permissions,
    },
  }
})

import { GlobalItemSearch } from './global-item-search'

const workspaceId = 'workspace-1'
const resultButtonName = /Chave da API de Produção/
const manualFileButtonName = /Manual PDF/

function makeItem(overrides: Partial<ItemResponse> = {}): ItemResponse {
  return {
    archivedAt: null,
    collectionId: null,
    description: null,
    id: 'item-1',
    linkUrl: null,
    preview: 'prévia',
    textContent: 'conteúdo completo',
    title: 'Chave da API de Produção',
    type: 'text',
    ...overrides,
  }
}

function makePage(items: ItemResponse[], totalPages = 1) {
  return {
    data: { items, page: 0, size: 20, totalItems: items.length, totalPages },
  }
}

async function openSearch() {
  const user = userEvent.setup()
  renderWithProviders(<GlobalItemSearch />)
  await user.click(
    screen.getByRole('button', { name: 'Buscar itens no workspace' })
  )
  const dialog = await screen.findByRole('dialog')
  return { dialog, user }
}

async function openUnavailableResult(
  status: number,
  user: ReturnType<typeof userEvent.setup>
) {
  apiMocks.get.mockRejectedValueOnce(new ApiError('detalhe interno', status))
  await user.click(screen.getByRole('button', { name: 'Fechar' }))
  await user.click(
    screen.getByRole('button', { name: 'Buscar itens no workspace' })
  )
  const dialog = await screen.findByRole('dialog')
  await user.click(
    await within(dialog).findByRole('button', { name: resultButtonName })
  )
  const message = (await screen.findByRole('alert')).textContent ?? ''
  expect(screen.queryByText('detalhe interno')).toBeNull()
  return message
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.listWorkspaces.mockResolvedValue({ data: [{ id: workspaceId }] })
  apiMocks.permissions.mockResolvedValue({
    data: {
      globalRole: 'ADMIN',
      isOwner: false,
      isTeamLeader: false,
      permissions: [{ action: 'read', resource: 'item' }],
      roleName: 'Admin',
      teamId: null,
    },
  })
  apiMocks.path.mockResolvedValue({
    data: [{ id: 'collection-1', name: 'Projetos' }],
  })
  apiMocks.downloadAttachment.mockResolvedValue({
    data: new Blob(['documento'], { type: 'application/pdf' }),
    headers: {},
  })
  apiMocks.search.mockResolvedValue(makePage([]))
  apiMocks.received.mockResolvedValue({
    data: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 },
  })
  apiMocks.get.mockResolvedValue({ data: makeItem() })
})

describe('GlobalItemSearch', () => {
  it('não consulta para busca vazia ou só com espaços', async () => {
    const { dialog, user } = await openSearch()
    const input = within(dialog).getByRole('searchbox', {
      name: 'Nome do item',
    })

    expect(apiMocks.search).not.toHaveBeenCalled()
    await user.type(input, '   ')

    expect(apiMocks.search).not.toHaveBeenCalled()
    expect(within(dialog).queryByText('Nenhum item encontrado')).toBeNull()
  })

  it('envia a consulta aparada com múltiplas palavras e parâmetros iniciais', async () => {
    apiMocks.search.mockResolvedValue(makePage([makeItem()]))
    const { dialog, user } = await openSearch()

    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      '  api producao  '
    )

    await waitFor(() => expect(apiMocks.search).toHaveBeenCalled())
    expect(apiMocks.search).toHaveBeenLastCalledWith(
      workspaceId,
      { includeArchived: false, page: 0, q: 'api producao', size: 20 },
      expect.any(AbortSignal)
    )
    expect(
      await within(dialog).findByText('Chave da API de Produção')
    ).toBeInTheDocument()
  })

  it('altera filtro de arquivados e pagina usando os parâmetros da API', async () => {
    apiMocks.search.mockImplementation(
      (_workspace: string, params: ItemSearchParams) =>
        Promise.resolve(makePage([makeItem({ id: `item-${params.page}` })], 3))
    )
    const { dialog, user } = await openSearch()
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'api'
    )
    await waitFor(() =>
      expect(apiMocks.search).toHaveBeenLastCalledWith(
        workspaceId,
        { includeArchived: false, page: 0, q: 'api', size: 20 },
        expect.any(AbortSignal)
      )
    )

    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Incluir itens arquivados' })
    )
    await waitFor(() =>
      expect(apiMocks.search).toHaveBeenLastCalledWith(
        workspaceId,
        { includeArchived: true, page: 0, q: 'api', size: 20 },
        expect.any(AbortSignal)
      )
    )
    await user.click(within(dialog).getByRole('button', { name: 'Próxima' }))
    await waitFor(() =>
      expect(apiMocks.search).toHaveBeenLastCalledWith(
        workspaceId,
        { includeArchived: true, page: 1, q: 'api', size: 20 },
        expect.any(AbortSignal)
      )
    )
    expect(within(dialog).getByText('Página 2 de 3')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Anterior' }))
    await waitFor(() =>
      expect(apiMocks.search).toHaveBeenLastCalledWith(
        workspaceId,
        { includeArchived: true, page: 0, q: 'api', size: 20 },
        expect.any(AbortSignal)
      )
    )
  })

  it('mostra carregamento, erro com retry e estado vazio', async () => {
    let resolveSearch: (value: ReturnType<typeof makePage>) => void = () =>
      undefined
    apiMocks.search.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve
      })
    )
    const { dialog, user } = await openSearch()
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'api'
    )
    expect(
      await within(dialog).findByText('Buscando itens…')
    ).toBeInTheDocument()
    resolveSearch(makePage([]))
    expect(
      await within(dialog).findByText('Nenhum item encontrado')
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Nenhum item encontrado'
    )

    apiMocks.search.mockRejectedValueOnce(new Error('falha'))
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'x'
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível pesquisar itens.'
    )
    apiMocks.search.mockResolvedValueOnce(makePage([]))
    const callsBeforeRetry = apiMocks.search.mock.calls.length
    await user.click(
      within(dialog).getByRole('button', { name: 'Tentar novamente' })
    )
    await waitFor(() =>
      expect(apiMocks.search.mock.calls.length).toBeGreaterThan(
        callsBeforeRetry
      )
    )
    expect(
      await within(dialog).findByText('Nenhum item encontrado')
    ).toBeInTheDocument()
  })

  it('exibe título, tipo e badge arquivado; omite caminho quando não há acesso à pasta', async () => {
    apiMocks.search.mockResolvedValue(
      makePage([
        makeItem({
          archivedAt: '2026-01-01T00:00:00Z',
          collectionId: 'restricted-collection',
          type: 'secret',
        }),
      ])
    )
    apiMocks.path.mockRejectedValue(new ApiError('negado', 403))
    const { dialog, user } = await openSearch()
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'chave'
    )
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      '1 resultado encontrado'
    )

    const result = await within(dialog).findByRole('listitem')
    expect(result).toHaveTextContent('Chave da API de Produção')
    expect(result).toHaveTextContent('Segredo')
    expect(result).toHaveTextContent('Arquivado')
    expect(result).not.toHaveTextContent('Projetos')
  })

  it('não revela caminho de cache da navegação antes da validação do caminho da busca', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(collectionKeys.path(workspaceId, 'restricted'), [
      { id: 'restricted', name: 'Pasta confidencial' },
    ])
    let rejectPath: (error: Error) => void = () => undefined
    apiMocks.path.mockReturnValue(
      new Promise((_, reject) => {
        rejectPath = reject
      })
    )
    apiMocks.search.mockResolvedValue(
      makePage([makeItem({ collectionId: 'restricted' })])
    )
    const user = userEvent.setup()
    renderWithProviders(<GlobalItemSearch />, { queryClient })
    await user.click(
      screen.getByRole('button', { name: 'Buscar itens no workspace' })
    )
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'chave'
    )
    const result = await within(dialog).findByRole('listitem')

    expect(result).toHaveTextContent('Chave da API de Produção')
    expect(result).not.toHaveTextContent('Pasta confidencial')
    rejectPath(new ApiError('negado', 403))
    await waitFor(() =>
      expect(apiMocks.path).toHaveBeenCalledWith(workspaceId, 'restricted')
    )
    expect(result).not.toHaveTextContent('Pasta confidencial')
  })

  it('revalida ao reabrir e oculta título e caminho em cache enquanto a busca está pendente', async () => {
    apiMocks.search.mockResolvedValue(
      makePage([makeItem({ collectionId: 'collection-1' })])
    )
    const { dialog, user } = await openSearch()
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'chave'
    )
    expect(await within(dialog).findByText('Projetos')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }))

    let resolveSearch: (value: ReturnType<typeof makePage>) => void = () =>
      undefined
    apiMocks.search.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve
      })
    )
    await user.click(
      screen.getByRole('button', { name: 'Buscar itens no workspace' })
    )
    const reopened = await screen.findByRole('dialog')
    expect(
      await within(reopened).findByText('Buscando itens…')
    ).toBeInTheDocument()
    expect(within(reopened).queryByText('Chave da API de Produção')).toBeNull()
    expect(within(reopened).queryByText('Projetos')).toBeNull()
    resolveSearch(makePage([]))
    expect(
      await within(reopened).findByText('Nenhum item encontrado')
    ).toBeInTheDocument()
    expect(within(reopened).queryByText('Chave da API de Produção')).toBeNull()
  })

  it('abre preview canônico de anexo após GET autorizado e não oferece preview sem autorização', async () => {
    const file = makeItem({
      collectionId: null,
      id: 'file-1',
      preview: null,
      textContent: null,
      title: 'Manual PDF',
      type: 'file',
    })
    apiMocks.search.mockResolvedValue(makePage([file]))
    apiMocks.get.mockResolvedValue({ data: file })
    const { dialog, user } = await openSearch()
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'manual'
    )
    await user.click(
      await within(dialog).findByRole('button', { name: manualFileButtonName })
    )
    const previewButton = await screen.findByRole('button', {
      name: 'Abrir documento Manual PDF',
    })
    expect(apiMocks.get).toHaveBeenCalledWith(workspaceId, 'file-1')
    await user.click(previewButton)
    const attachmentDialog = await screen.findByRole('dialog', {
      name: 'Manual PDF',
    })
    await user.click(
      within(attachmentDialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(
      await within(attachmentDialog).findByTitle('Visualização de Manual PDF')
    ).toBeInTheDocument()
    expect(apiMocks.downloadAttachment).toHaveBeenCalledWith(
      workspaceId,
      'file-1'
    )
    expect(
      within(attachmentDialog).getByRole('button', { name: 'Baixar arquivo' })
    ).toBeInTheDocument()

    await user.click(
      within(attachmentDialog).getByRole('button', { name: 'Fechar' })
    )
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    apiMocks.get.mockRejectedValueOnce(new ApiError('forbidden', 403))
    await user.click(
      screen.getByRole('button', { name: 'Buscar itens no workspace' })
    )
    const secondSearch = await screen.findByRole('dialog')
    await user.click(
      await within(secondSearch).findByRole('button', {
        name: manualFileButtonName,
      })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Item indisponível'
    )
    expect(
      screen.queryByRole('button', { name: 'Abrir documento Manual PDF' })
    ).toBeNull()
    expect(apiMocks.downloadAttachment).toHaveBeenCalledOnce()
  })

  it('ao abrir, busca o item novamente e apresenta indisponível para 403 e 404', async () => {
    apiMocks.search.mockResolvedValue(makePage([makeItem()]))
    const { dialog, user } = await openSearch()
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Nome do item' }),
      'chave'
    )
    await user.click(
      await within(dialog).findByRole('button', { name: resultButtonName })
    )
    expect(await screen.findByText('Ver item')).toBeInTheDocument()
    await waitFor(() =>
      expect(apiMocks.get).toHaveBeenCalledWith(workspaceId, 'item-1')
    )

    // Closing and searching again simulates another selected result whose access
    // was revoked (403) or whose item was deleted (404) after the search.
    const unavailableMessages = [
      await openUnavailableResult(403, user),
      await openUnavailableResult(404, user),
    ]
    expect(unavailableMessages).toEqual([
      'Item indisponível',
      'Item indisponível',
    ])
  })
})
