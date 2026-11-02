// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import type { ItemResponse } from '@/api/types'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  archive: vi.fn(),
  get: vi.fn(),
  restore: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      archive: apiMocks.archive,
      get: apiMocks.get,
      restore: apiMocks.restore,
    },
  }
})

import { ItemListCard } from './item-list-card'

const workspaceId = 'workspace-1'

function makeItem(overrides: Partial<ItemResponse> = {}): ItemResponse {
  return {
    archivedAt: null,
    collectionId: null,
    description: null,
    id: 'item-1',
    linkUrl: null,
    preview: 'prévia',
    textContent: null,
    title: 'Meu item',
    type: 'text',
    ...overrides,
  }
}

async function openMenu(item: ItemResponse) {
  const user = userEvent.setup()
  const onCopy = vi.fn()
  renderWithProviders(
    <ItemListCard item={item} onCopy={onCopy} workspaceId={workspaceId} />
  )
  await user.click(
    screen.getByRole('button', { name: `Ações de ${item.title}` })
  )
  return { onCopy, user }
}

const menuLabels = () =>
  screen.getAllByRole('menuitem').map((element) => element.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.archive.mockResolvedValue({ data: undefined })
  apiMocks.restore.mockResolvedValue({ data: undefined })
  apiMocks.get.mockReturnValue(new Promise(() => undefined))
})

afterEach(() => vi.restoreAllMocks())

describe('ItemListCard', () => {
  it('item ativo oferece Editar, copiar e Arquivar por último, sem badge', async () => {
    await openMenu(makeItem())

    expect(menuLabels()).toEqual([
      'Editar',
      'Copiar título',
      'Copiar conteúdo',
      'Arquivar',
    ])
    expect(screen.queryByText('Arquivado')).toBeNull()
  })

  it('item arquivado mostra badge e deixa Excluir definitivamente por último', async () => {
    await openMenu(makeItem({ archivedAt: '2026-01-01T00:00:00Z' }))

    expect(screen.getByText('Arquivado')).toBeInTheDocument()
    expect(menuLabels()).toEqual([
      'Ver',
      'Copiar título',
      'Copiar conteúdo',
      'Restaurar',
      'Excluir definitivamente',
    ])
  })

  it('arquivar chama a API e só então avisa o sucesso', async () => {
    const successSpy = vi.spyOn(toast, 'success')
    const { user } = await openMenu(makeItem())

    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }))

    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith('Item arquivado.')
    )
    expect(apiMocks.archive).toHaveBeenCalledWith(workspaceId, 'item-1')
  })

  it('409 ao arquivar mostra toast de erro com a mensagem do servidor', async () => {
    apiMocks.archive.mockRejectedValue(new ApiError('Item já arquivado', 409))
    const errorSpy = vi.spyOn(toast, 'error')
    const successSpy = vi.spyOn(toast, 'success')
    const { user } = await openMenu(makeItem())

    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }))

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Item já arquivado')
    )
    expect(successSpy).not.toHaveBeenCalled()
  })

  it('restaurar chama a API e avisa o sucesso', async () => {
    const successSpy = vi.spyOn(toast, 'success')
    const { user } = await openMenu(
      makeItem({ archivedAt: '2026-01-01T00:00:00Z' })
    )

    await user.click(screen.getByRole('menuitem', { name: 'Restaurar' }))

    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith('Item restaurado.')
    )
    expect(apiMocks.restore).toHaveBeenCalledWith(workspaceId, 'item-1')
  })

  it('erro de rede ao restaurar mostra o aviso RN21 sem sucesso', async () => {
    apiMocks.restore.mockRejectedValue(
      new ApiError('x', undefined, undefined, undefined, { networkError: true })
    )
    const errorSpy = vi.spyOn(toast, 'error')
    const successSpy = vi.spyOn(toast, 'success')
    const { user } = await openMenu(
      makeItem({ archivedAt: '2026-01-01T00:00:00Z' })
    )

    await user.click(screen.getByRole('menuitem', { name: 'Restaurar' }))

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Não foi possível confirmar a alteração. Confira o item antes de tentar novamente.'
      )
    )
    expect(successSpy).not.toHaveBeenCalled()
  })

  it('ignora segundo arquivar enquanto o primeiro está pendente', async () => {
    apiMocks.archive.mockReturnValue(new Promise(() => undefined))
    const { user } = await openMenu(makeItem())

    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }))
    await waitFor(() => expect(apiMocks.archive).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Ações de Meu item' }))
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }))

    expect(apiMocks.archive).toHaveBeenCalledTimes(1)
  })

  it('ignora segundo restaurar enquanto o primeiro está pendente', async () => {
    apiMocks.restore.mockReturnValue(new Promise(() => undefined))
    const { user } = await openMenu(
      makeItem({ archivedAt: '2026-01-01T00:00:00Z' })
    )

    await user.click(screen.getByRole('menuitem', { name: 'Restaurar' }))
    await waitFor(() => expect(apiMocks.restore).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Ações de Meu item' }))
    await user.click(screen.getByRole('menuitem', { name: 'Restaurar' }))

    expect(apiMocks.restore).toHaveBeenCalledTimes(1)
  })

  it('Excluir definitivamente abre o diálogo de confirmação sem chamar a API', async () => {
    const { user } = await openMenu(
      makeItem({ archivedAt: '2026-01-01T00:00:00Z' })
    )

    await user.click(
      screen.getByRole('menuitem', { name: 'Excluir definitivamente' })
    )

    expect(
      await screen.findByLabelText('Digite o título do item para confirmar')
    ).toBeInTheDocument()
  })

  it('Editar abre o diálogo de edição', async () => {
    const { user } = await openMenu(makeItem())

    await user.click(screen.getByRole('menuitem', { name: 'Editar' }))

    expect(await screen.findByText('Editar item')).toBeInTheDocument()
    expect(apiMocks.get).toHaveBeenCalledWith(workspaceId, 'item-1')
  })

  it('Copiar título repassa o título ao callback', async () => {
    const { onCopy, user } = await openMenu(makeItem())

    await user.click(screen.getByRole('menuitem', { name: 'Copiar título' }))

    expect(onCopy).toHaveBeenCalledWith('Meu item', 'title')
  })

  it('Copiar conteúdo busca o texto completo, pois a listagem só traz a prévia', async () => {
    apiMocks.get.mockResolvedValue({
      data: makeItem({ preview: 'cor…', textContent: 'corpo completo' }),
    })
    const { onCopy, user } = await openMenu(
      makeItem({ preview: 'cor…', textContent: null })
    )

    await user.click(screen.getByRole('menuitem', { name: 'Copiar conteúdo' }))

    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith('corpo completo', 'content')
    )
    expect(apiMocks.get).toHaveBeenCalledWith(workspaceId, 'item-1')
  })

  it('Copiar conteúdo de link busca a URL completa', async () => {
    apiMocks.get.mockResolvedValue({
      data: makeItem({
        linkUrl: 'https://exemplo.com/caminho-longo',
        textContent: null,
        type: 'link',
      }),
    })
    const { onCopy, user } = await openMenu(
      makeItem({ linkUrl: null, textContent: null, type: 'link' })
    )

    await user.click(screen.getByRole('menuitem', { name: 'Copiar conteúdo' }))

    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith(
        'https://exemplo.com/caminho-longo',
        'content'
      )
    )
  })

  it('Copiar conteúdo avisa o erro quando a busca falha', async () => {
    const errorSpy = vi.spyOn(toast, 'error')
    apiMocks.get.mockRejectedValue(new ApiError('falhou', 500))
    const { onCopy, user } = await openMenu(makeItem({ textContent: null }))

    await user.click(screen.getByRole('menuitem', { name: 'Copiar conteúdo' }))

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Não foi possível copiar o conteúdo.'
      )
    )
    expect(onCopy).not.toHaveBeenCalled()
  })

  it('não oferece Copiar conteúdo para segredos', async () => {
    await openMenu(makeItem({ textContent: null, type: 'secret' }))

    expect(menuLabels()).not.toContain('Copiar conteúdo')
  })

  it('oculta a prévia de segredos e renderiza documentos', () => {
    renderWithProviders(
      <>
        <ItemListCard
          item={makeItem({
            preview: 'valor-secreto',
            title: 'S',
            type: 'secret',
          })}
          onCopy={vi.fn()}
          workspaceId={workspaceId}
        />
        <ItemListCard
          item={makeItem({
            id: 'f',
            preview: 'doc.pdf',
            title: 'D',
            type: 'file',
          })}
          onCopy={vi.fn()}
          workspaceId={workspaceId}
        />
      </>
    )

    expect(screen.queryByText('valor-secreto')).toBeNull()
    expect(screen.getByText('••••••••••••')).toBeInTheDocument()
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
    expect(screen.getByText('file')).toBeInTheDocument()
  })
})
