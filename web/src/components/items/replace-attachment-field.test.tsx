// @vitest-environment happy-dom

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({ replaceAttachment: vi.fn() }))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      replaceAttachment: apiMocks.replaceAttachment,
    },
  }
})

import { ReplaceAttachmentField } from '@/components/items/replace-attachment-field'

const replaceButton = () =>
  screen.getByRole('button', { name: 'Substituir arquivo' })

const onPendingChange = vi.fn()

function renderField(disabled = false) {
  renderWithProviders(
    <ReplaceAttachmentField
      disabled={disabled}
      itemId='item-1'
      onPendingChange={onPendingChange}
      workspaceId='workspace-1'
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.replaceAttachment.mockResolvedValue({ data: {} })
})

afterEach(() => vi.restoreAllMocks())

describe('ReplaceAttachmentField', () => {
  it('começa sem arquivo e com o botão desabilitado', () => {
    renderField()

    expect(replaceButton()).toBeDisabled()
  })

  it('restringe o accept às extensões permitidas', () => {
    renderField()

    expect(screen.getByLabelText('SUBSTITUIR ARQUIVO')).toHaveAttribute(
      'accept',
      '.pdf,.txt,.md,.docx,.xlsx,.pptx,.png,.jpg,.jpeg'
    )
  })

  it('envia o arquivo válido com os ids corretos e o AbortSignal', async () => {
    const user = userEvent.setup()
    renderField()
    const file = new File(['x'], 'doc.pdf')

    await user.upload(screen.getByLabelText('SUBSTITUIR ARQUIVO'), file)
    await user.click(replaceButton())

    await waitFor(() =>
      expect(apiMocks.replaceAttachment).toHaveBeenCalledOnce()
    )
    const [workspace, item, sent, options] =
      apiMocks.replaceAttachment.mock.calls[0] ?? []
    expect(workspace).toBe('workspace-1')
    expect(item).toBe('item-1')
    expect(sent).toBe(file)
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('arquivo inválido mostra erro e não habilita o envio', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'script.sh')
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Formato não suportado'
    )
    expect(replaceButton()).toBeDisabled()
    expect(apiMocks.replaceAttachment).not.toHaveBeenCalled()
  })

  it('400 do servidor acrescenta o motivo ao aviso', async () => {
    apiMocks.replaceAttachment.mockRejectedValue(
      new ApiError('Arquivo corrompido', 400)
    )
    const user = userEvent.setup()
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'doc.pdf')
    )
    await user.click(replaceButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A substituição não foi concluída; o arquivo anterior continua disponível. Arquivo corrompido'
    )
  })

  it('rede não afirma que o arquivo anterior foi preservado (RN21)', async () => {
    apiMocks.replaceAttachment.mockRejectedValue(
      new ApiError('x', undefined, undefined, undefined, { networkError: true })
    )
    const user = userEvent.setup()
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'doc.pdf')
    )
    await user.click(replaceButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível confirmar a substituição')
    expect(alert).not.toHaveTextContent('continua disponível')
  })

  it('informa o estado pendente ao diálogo durante o envio', async () => {
    let resolve: (value: unknown) => void = () => undefined
    apiMocks.replaceAttachment.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const user = userEvent.setup()
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'doc.pdf')
    )
    await user.click(replaceButton())
    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(true))

    resolve({ data: {} })
    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(false))
  })

  it('cancelar o envio mostra resultado desconhecido e sem sucesso', async () => {
    const successSpy = vi.spyOn(toast, 'success')
    apiMocks.replaceAttachment.mockImplementation(
      (_w: string, _i: string, _f: File, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(
              new ApiError('canceled', undefined, undefined, undefined, {
                canceled: true,
              })
            )
          )
        })
    )
    const user = userEvent.setup()
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'doc.pdf')
    )
    await user.click(replaceButton())
    await user.click(
      await screen.findByRole('button', { name: 'Cancelar envio' })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar a substituição'
    )
    expect(successSpy).not.toHaveBeenCalled()
  })

  it('desabilitado bloqueia a escolha de arquivo', () => {
    renderField(true)

    expect(screen.getByLabelText('SUBSTITUIR ARQUIVO')).toBeDisabled()
    expect(replaceButton()).toBeDisabled()
  })

  it('mostra o progresso real e bloqueia o input durante o envio', async () => {
    let resolve: (value: unknown) => void = () => undefined
    apiMocks.replaceAttachment.mockImplementation(
      (
        _w: string,
        _i: string,
        _f: File,
        { onUploadProgress }: { onUploadProgress: (value: number) => void }
      ) => {
        onUploadProgress(42)
        return new Promise((done) => {
          resolve = done
        })
      }
    )
    const user = userEvent.setup()
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'doc.pdf')
    )
    await user.click(replaceButton())

    expect(await screen.findByText('42%')).toBeInTheDocument()
    expect(screen.getByLabelText('SUBSTITUIR ARQUIVO')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Cancelar envio' })
    ).toBeInTheDocument()

    resolve({ data: {} })
    await waitFor(() => expect(screen.queryByText('42%')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Cancelar envio' })).toBeNull()
    expect(screen.getByLabelText('SUBSTITUIR ARQUIVO')).toBeEnabled()
  })

  it('não mostra progresso nem cancelar antes de enviar', () => {
    renderField()

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar envio' })).toBeNull()
  })

  it('limpa o arquivo escolhido após substituir com sucesso', async () => {
    const user = userEvent.setup()
    renderField()

    await user.upload(
      screen.getByLabelText('SUBSTITUIR ARQUIVO'),
      new File(['x'], 'doc.pdf')
    )
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
    await user.click(replaceButton())

    await waitFor(() => expect(screen.queryByText('doc.pdf')).toBeNull())
    expect(replaceButton()).toBeDisabled()
  })
})
