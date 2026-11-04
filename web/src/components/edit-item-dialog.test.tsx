// @vitest-environment happy-dom

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import type { ItemResponse } from '@/api/types'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  replaceAttachment: vi.fn(),
  revealSecret: vi.fn(),
  update: vi.fn(),
  updateMetadata: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      get: apiMocks.get,
      replaceAttachment: apiMocks.replaceAttachment,
      revealSecret: apiMocks.revealSecret,
      update: apiMocks.update,
      updateMetadata: apiMocks.updateMetadata,
    },
  }
})

import { EditItemDialog } from './edit-item-dialog'

const workspaceId = 'workspace-1'
const itemId = 'item-1'
const RESTORE_NOTICE = 'Restaure o item antes de editar.'
const TYPE_NOTICE =
  'O tipo não pode ser alterado. Para mudar o tipo, crie um novo item.'
const UNCONFIRMED =
  'Não foi possível confirmar a alteração. Confira o item antes de tentar novamente.'

function makeItem(overrides: Partial<ItemResponse> = {}): ItemResponse {
  return {
    archivedAt: null,
    collectionId: null,
    description: null,
    id: itemId,
    linkUrl: null,
    preview: null,
    textContent: 'conteúdo original',
    title: 'Título original',
    type: 'text',
    ...overrides,
  }
}

async function openDialog(item: ItemResponse) {
  apiMocks.get.mockResolvedValue({ data: item })
  const onClose = vi.fn()
  renderWithProviders(
    <EditItemDialog
      itemId={itemId}
      onClose={onClose}
      readOnly={false}
      workspaceId={workspaceId}
    />
  )
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByLabelText('TÍTULO')
  return { dialog, onClose }
}

function setValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.update.mockResolvedValue({ data: makeItem() })
  apiMocks.updateMetadata.mockResolvedValue({ data: undefined })
  apiMocks.replaceAttachment.mockResolvedValue({ data: {} })
  apiMocks.revealSecret.mockResolvedValue({ data: { value: 'segredo atual' } })
})

afterEach(() => vi.restoreAllMocks())

describe('EditItemDialog (texto, link e segredo)', () => {
  it('bloqueia o tipo e exibe o aviso', async () => {
    const { dialog } = await openDialog(makeItem())

    expect(within(dialog).getByLabelText('TIPO')).toBeDisabled()
    expect(within(dialog).getByText(TYPE_NOTICE)).toBeInTheDocument()
  })

  it('envia o texto editado com o título aparado e fecha só após o sucesso', async () => {
    const successSpy = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    const { dialog, onClose } = await openDialog(makeItem())

    setValue(within(dialog).getByLabelText('TÍTULO'), '  Novo título  ')
    setValue(within(dialog).getByLabelText('CONTEÚDO'), 'novo texto')
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(apiMocks.update).toHaveBeenCalledOnce()
    expect(apiMocks.update).toHaveBeenCalledWith(workspaceId, itemId, {
      textContent: 'novo texto',
      title: 'Novo título',
    })
    expect(successSpy).toHaveBeenCalledWith('Item atualizado.')
  })

  it('envia o link aparado', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(
      makeItem({ linkUrl: 'https://a.com', textContent: null, type: 'link' })
    )

    setValue(within(dialog).getByLabelText('URL'), ' https://b.com ')
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledOnce())
    expect(apiMocks.update).toHaveBeenCalledWith(workspaceId, itemId, {
      linkUrl: 'https://b.com',
      title: 'Título original',
    })
  })

  it('rejeita URL ftp sem chamar a API', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(
      makeItem({ linkUrl: 'https://a.com', textContent: null, type: 'link' })
    )

    setValue(within(dialog).getByLabelText('URL'), 'ftp://a.com/x')
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'http:// ou https://'
    )
    expect(apiMocks.update).not.toHaveBeenCalled()
  })

  it('valida título: 255 aceito, 256 rejeitado', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(makeItem())
    const title = within(dialog).getByLabelText('TÍTULO')

    setValue(title, 'a'.repeat(256))
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'até 255 caracteres'
    )
    expect(apiMocks.update).not.toHaveBeenCalled()

    setValue(title, 'a'.repeat(255))
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledOnce())
  })

  it('valida texto: só espaços e 100001 rejeitados, 100000 aceito', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(makeItem())
    const content = within(dialog).getByLabelText('CONTEÚDO')
    const save = within(dialog).getByRole('button', { name: 'SALVAR' })

    setValue(content, '    ')
    await user.click(save)
    setValue(content, 'a'.repeat(100_001))
    await user.click(save)
    expect(apiMocks.update).not.toHaveBeenCalled()
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()

    setValue(content, 'a'.repeat(100_000))
    await user.click(save)
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledOnce())
  })

  it('segredo: carrega pelo reveal e envia o valor sem aparar', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(
      makeItem({ textContent: null, type: 'secret' })
    )
    const value = within(dialog).getByLabelText('VALOR DO SEGREDO')
    expect(value).toHaveValue('segredo atual')

    setValue(value, '  com espaços  ')
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledOnce())
    expect(apiMocks.update).toHaveBeenCalledWith(workspaceId, itemId, {
      title: 'Título original',
      value: '  com espaços  ',
    })
  })

  it('segredo: 8192 aceito e 8193 rejeitado', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(
      makeItem({ textContent: null, type: 'secret' })
    )
    const value = within(dialog).getByLabelText('VALOR DO SEGREDO')
    const save = within(dialog).getByRole('button', { name: 'SALVAR' })

    setValue(value, 'a'.repeat(8193))
    await user.click(save)
    expect(apiMocks.update).not.toHaveBeenCalled()

    setValue(value, 'a'.repeat(8192))
    await user.click(save)
    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledOnce())
  })

  it('segredo: negado no reveal informa que não é possível editar', async () => {
    apiMocks.revealSecret.mockRejectedValue(new ApiError('negado', 403))
    apiMocks.get.mockResolvedValue({
      data: makeItem({ textContent: null, type: 'secret' }),
    })
    renderWithProviders(
      <EditItemDialog
        itemId={itemId}
        onClose={vi.fn()}
        readOnly={false}
        workspaceId={workspaceId}
      />
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não é possível editar este segredo'
    )
    expect(screen.queryByRole('button', { name: 'SALVAR' })).toBeNull()
  })

  it('item arquivado fica bloqueado e nunca dispara PUT', async () => {
    const { dialog } = await openDialog(
      makeItem({ archivedAt: '2026-01-01T00:00:00Z' })
    )

    expect(within(dialog).getByText(RESTORE_NOTICE)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: 'Item arquivado' })
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('TÍTULO')).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'SALVAR' })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'FECHAR' })).toBeEnabled()
    const form = within(dialog).getByLabelText('TÍTULO').closest('form')
    if (!form) throw new Error('form ausente')
    fireEvent.submit(form)
    expect(apiMocks.update).not.toHaveBeenCalled()
  })

  it('segredo arquivado não mostra campo vazio e explica que o valor fica oculto', async () => {
    const { dialog } = await openDialog(
      makeItem({ archivedAt: '2026-01-01T00:00:00Z', type: 'secret' })
    )

    expect(
      within(dialog).getByText(
        'O valor fica oculto enquanto o item está arquivado.'
      )
    ).toBeInTheDocument()
    expect(apiMocks.revealSecret).not.toHaveBeenCalled()
  })

  it('409 mostra título indisponível e mantém o diálogo e os dados digitados', async () => {
    apiMocks.update.mockRejectedValue(new ApiError('detalhe', 409))
    const user = userEvent.setup()
    const { dialog, onClose } = await openDialog(makeItem())

    setValue(within(dialog).getByLabelText('TÍTULO'), 'Repetido')
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Título indisponível nesta localização'
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog).getByLabelText('TÍTULO')).toHaveValue('Repetido')
  })

  it('erro de rede mostra o aviso RN21 sem toast de sucesso nem reenvio', async () => {
    apiMocks.update.mockRejectedValue(
      new ApiError('x', undefined, undefined, undefined, { networkError: true })
    )
    const successSpy = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    const { dialog, onClose } = await openDialog(makeItem())

    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      UNCONFIRMED
    )
    expect(successSpy).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(apiMocks.update).toHaveBeenCalledOnce()
  })

  it('desabilita o salvamento enquanto a requisição está pendente', async () => {
    let resolveUpdate: (value: unknown) => void = () => undefined
    apiMocks.update.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      })
    )
    const user = userEvent.setup()
    const { dialog, onClose } = await openDialog(makeItem())

    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))
    await waitFor(() =>
      expect(within(dialog).getByLabelText('TÍTULO')).toBeDisabled()
    )
    expect(
      within(dialog).getByRole('button', { name: 'SALVAR' })
    ).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()

    resolveUpdate({ data: makeItem() })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(apiMocks.update).toHaveBeenCalledOnce()
  })

  it('erro ao carregar o item mostra alerta', async () => {
    apiMocks.get.mockRejectedValue(new ApiError('x', 404))
    renderWithProviders(
      <EditItemDialog
        itemId={itemId}
        onClose={vi.fn()}
        readOnly={false}
        workspaceId={workspaceId}
      />
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Item indisponível'
    )
  })

  it('erro de carregamento 500 usa mensagem de leitura, não de edição', async () => {
    apiMocks.get.mockRejectedValue(new ApiError('', 500))
    renderWithProviders(
      <EditItemDialog
        itemId={itemId}
        onClose={vi.fn()}
        readOnly={false}
        workspaceId={workspaceId}
      />
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o item.'
    )
  })
})

describe('EditItemDialog (documento)', () => {
  const documentItem = () =>
    makeItem({
      description: 'desc atual',
      textContent: null,
      title: 'Relatório',
      type: 'file',
    })

  it('edita título e descrição por metadata, sem campo de conteúdo', async () => {
    const user = userEvent.setup()
    const { dialog, onClose } = await openDialog(documentItem())

    expect(within(dialog).getByLabelText('TIPO')).toBeDisabled()
    expect(within(dialog).queryByLabelText('CONTEÚDO')).toBeNull()
    setValue(within(dialog).getByLabelText('DESCRIÇÃO'), '  nova  ')
    await user.click(within(dialog).getByRole('button', { name: 'SALVAR' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(apiMocks.updateMetadata).toHaveBeenCalledWith(workspaceId, itemId, {
      description: 'nova',
      title: 'Relatório',
    })
    expect(apiMocks.update).not.toHaveBeenCalled()
  })

  it('descrição: 2000 aceita e 2001 rejeitada', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(documentItem())
    const description = within(dialog).getByLabelText('DESCRIÇÃO')
    const save = within(dialog).getByRole('button', { name: 'SALVAR' })

    setValue(description, 'a'.repeat(2001))
    await user.click(save)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '2000 caracteres'
    )
    expect(apiMocks.updateMetadata).not.toHaveBeenCalled()

    setValue(description, 'a'.repeat(2000))
    await user.click(save)
    await waitFor(() => expect(apiMocks.updateMetadata).toHaveBeenCalledOnce())
  })

  it('arquivo inválido (extensão) não é enviado', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { dialog } = await openDialog(documentItem())

    await user.upload(
      within(dialog).getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'virus.exe')
    )

    expect(
      await within(dialog).findByText('Formato não suportado', { exact: false })
    ).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: 'Substituir arquivo' })
    ).toBeDisabled()
    expect(apiMocks.replaceAttachment).not.toHaveBeenCalled()
  })

  it('arquivo acima de 20.000.000 bytes não é enviado', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(documentItem())
    const big = new File(['x'], 'grande.pdf')
    Object.defineProperty(big, 'size', { value: 20_000_001 })

    await user.upload(within(dialog).getByLabelText('SUBSTITUIR ARQUIVO'), big)

    expect(
      await within(dialog).findByText('limite de 20 MB', { exact: false })
    ).toBeVisible()
    expect(apiMocks.replaceAttachment).not.toHaveBeenCalled()
  })

  it('arquivo de exatamente 20.000.000 bytes é enviado', async () => {
    const user = userEvent.setup()
    const { dialog } = await openDialog(documentItem())
    const limit = new File(['x'], 'limite.pdf')
    Object.defineProperty(limit, 'size', { value: 20_000_000 })

    await user.upload(
      within(dialog).getByLabelText('SUBSTITUIR ARQUIVO'),
      limit
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Substituir arquivo' })
    )

    await waitFor(() =>
      expect(apiMocks.replaceAttachment).toHaveBeenCalledOnce()
    )
    expect(apiMocks.replaceAttachment.mock.calls[0]?.[2]).toBe(limit)
  })

  it('falha na substituição mantém o aviso de arquivo anterior disponível', async () => {
    apiMocks.replaceAttachment.mockRejectedValue(new ApiError('', 503))
    const successSpy = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    const { dialog } = await openDialog(documentItem())

    await user.upload(
      within(dialog).getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'novo.pdf')
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Substituir arquivo' })
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A substituição não foi concluída; o arquivo anterior continua disponível.'
    )
    expect(successSpy).not.toHaveBeenCalled()
  })

  it('substituição bem-sucedida mostra sucesso só após a resposta', async () => {
    const successSpy = vi.spyOn(toast, 'success')
    const user = userEvent.setup()
    const { dialog } = await openDialog(documentItem())

    await user.upload(
      within(dialog).getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'novo.pdf')
    )
    expect(successSpy).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', { name: 'Substituir arquivo' })
    )

    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith('Arquivo substituído.')
    )
  })

  it('bloqueia salvar e fechar enquanto a substituição está em andamento', async () => {
    apiMocks.replaceAttachment.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    const { dialog, onClose } = await openDialog(documentItem())

    await user.upload(
      within(dialog).getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'novo.pdf')
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Substituir arquivo' })
    )

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'CANCELAR' })
      ).toBeDisabled()
    )
    expect(
      within(dialog).getByRole('button', { name: 'SALVAR' })
    ).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('item arquivado: metadados bloqueados e substituição oculta', async () => {
    const { dialog } = await openDialog({
      ...documentItem(),
      archivedAt: '2026-01-01T00:00:00Z',
    })

    expect(within(dialog).getByText(RESTORE_NOTICE)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'SALVAR' })).toBeNull()
    expect(
      within(dialog).queryByRole('button', { name: 'Substituir arquivo' })
    ).toBeNull()
    expect(apiMocks.updateMetadata).not.toHaveBeenCalled()
    expect(apiMocks.replaceAttachment).not.toHaveBeenCalled()
  })
})

it.each(['text', 'file', 'secret'] as const)(
  'keeps %s items read-only and rejects form submission',
  async (type) => {
    apiMocks.get.mockResolvedValue({ data: makeItem({ type }) })
    renderWithProviders(
      <EditItemDialog
        itemId={itemId}
        onClose={vi.fn()}
        readOnly
        workspaceId={workspaceId}
      />
    )
    const title = await screen.findByLabelText('TÍTULO')
    expect(title).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'SALVAR' })).toBeNull()
    expect(screen.queryByText('Substituir arquivo')).toBeNull()
    fireEvent.submit(title.closest('form') as HTMLFormElement)
    expect(apiMocks.update).not.toHaveBeenCalled()
    expect(apiMocks.updateMetadata).not.toHaveBeenCalled()
    if (type === 'secret') {
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Mostrar conteúdo' }))
      expect(screen.getByLabelText('VALOR DO SEGREDO')).toHaveAttribute(
        'type',
        'text'
      )
    }
  }
)
