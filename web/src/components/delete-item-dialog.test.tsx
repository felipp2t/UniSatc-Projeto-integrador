// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import type { ItemResponse } from '@/api/types'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({ remove: vi.fn() }))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    itemsApi: { ...actual.itemsApi, remove: apiMocks.remove },
  }
})

import { DeleteItemDialog } from './delete-item-dialog'

const workspaceId = 'workspace-1'
const TITLE = 'Contrato 2026'

function makeItem(overrides: Partial<ItemResponse> = {}): ItemResponse {
  return {
    archivedAt: '2026-01-01T00:00:00Z',
    collectionId: null,
    description: null,
    id: 'item-1',
    linkUrl: null,
    preview: null,
    textContent: 'x',
    title: TITLE,
    type: 'text',
    ...overrides,
  }
}

function renderDialog(item = makeItem()) {
  const onClose = vi.fn()
  renderWithProviders(
    <DeleteItemDialog item={item} onClose={onClose} workspaceId={workspaceId} />
  )
  return { onClose }
}

const confirmButton = () =>
  screen.getByRole('button', { name: 'Excluir definitivamente' })
const confirmInput = () =>
  screen.getByLabelText('Digite o título do item para confirmar')

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.remove.mockResolvedValue({ data: undefined })
})

afterEach(() => vi.restoreAllMocks())

describe('DeleteItemDialog', () => {
  it('mostra o título e o aviso de irreversibilidade', () => {
    renderDialog()

    expect(screen.getAllByText(TITLE).length).toBeGreaterThan(0)
    expect(
      screen.getByText('Esta ação não pode ser desfeita', { exact: false })
    ).toBeInTheDocument()
  })

  it('mantém o botão desabilitado até digitar o título exato', async () => {
    const user = userEvent.setup()
    renderDialog()
    expect(confirmButton()).toBeDisabled()

    await user.type(confirmInput(), 'Contrato 202')
    expect(confirmButton()).toBeDisabled()

    await user.type(confirmInput(), '6')
    expect(confirmButton()).toBeEnabled()

    await user.clear(confirmInput())
    await user.type(confirmInput(), 'contrato 2026')
    expect(confirmButton()).toBeDisabled()
  })

  it('aceita o título digitado com espaços nas pontas', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(confirmInput(), `  ${TITLE}  `)

    expect(confirmButton()).toBeEnabled()
  })

  it('não habilita para item ativo mesmo com o título certo', async () => {
    const user = userEvent.setup()
    renderDialog(makeItem({ archivedAt: null }))

    await user.type(confirmInput(), TITLE)

    expect(confirmButton()).toBeDisabled()
    fireEvent.click(confirmButton())
    expect(apiMocks.remove).not.toHaveBeenCalled()
  })

  it('chama a exclusão uma única vez enquanto pendente e fecha após o sucesso', async () => {
    let resolveRemove: (value: unknown) => void = () => undefined
    apiMocks.remove.mockReturnValue(
      new Promise((resolve) => {
        resolveRemove = resolve
      })
    )
    const successSpy = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.type(confirmInput(), TITLE)
    await user.dblClick(confirmButton())
    expect(onClose).not.toHaveBeenCalled()
    expect(successSpy).not.toHaveBeenCalled()

    resolveRemove({ data: undefined })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(apiMocks.remove).toHaveBeenCalledOnce()
    expect(apiMocks.remove).toHaveBeenCalledWith(workspaceId, 'item-1')
    expect(successSpy).toHaveBeenCalledOnce()
  })

  it('exibe o erro em alerta e mantém o diálogo aberto', async () => {
    apiMocks.remove.mockRejectedValue(
      new ApiError('Somente itens arquivados podem ser excluídos', 409)
    )
    const successSpy = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.type(confirmInput(), TITLE)
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Somente itens arquivados podem ser excluídos'
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(successSpy).not.toHaveBeenCalled()
  })

  it('Cancelar fecha sem chamar a exclusão', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(apiMocks.remove).not.toHaveBeenCalled()
  })
})
