// @vitest-environment happy-dom

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  collectionsList: vi.fn(),
  createAttachment: vi.fn(),
  itemsCreate: vi.fn(),
  workspaceList: vi.fn(),
  workspacePermissions: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: {
      ...actual.collectionsApi,
      list: apiMocks.collectionsList,
    },
    itemsApi: {
      ...actual.itemsApi,
      create: apiMocks.itemsCreate,
      createAttachment: apiMocks.createAttachment,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      list: apiMocks.workspaceList,
      permissions: apiMocks.workspacePermissions,
    },
  }
})

import { CreateItemDialog } from './create-item-dialog'

const workspaceId = 'workspace-1'

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.workspacePermissions.mockResolvedValue({
    data: {
      isOwner: false,
      permissions: [
        { action: 'all', resource: 'item' },
        { action: 'all', resource: 'collection' },
        { action: 'all', resource: 'secret' },
      ],
      roleId: 'role-1',
      roleName: 'Editor',
    },
  })
  apiMocks.collectionsList.mockResolvedValue({
    data: { items: [], page: 0, size: 100, totalItems: 0, totalPages: 1 },
  })
  apiMocks.workspaceList.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace' }],
  })
  apiMocks.itemsCreate.mockRejectedValue(new Error('Unexpected test setup'))
  apiMocks.createAttachment.mockResolvedValue({ data: {} })
})

afterEach(() => vi.restoreAllMocks())

async function submitItem(type: 'secret' | 'text') {
  const user = userEvent.setup()
  renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
  await user.click(screen.getByRole('button', { name: 'Novo item' }))
  const dialog = await screen.findByRole('dialog')
  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: 'CRIAR' })).toBeEnabled()
  })
  await user.type(within(dialog).getByLabelText('TÍTULO'), 'Test item')
  if (type === 'secret') {
    await user.click(within(dialog).getByRole('button', { name: 'segredo' }))
    await user.type(
      within(dialog).getByLabelText('VALOR DO SEGREDO'),
      'secret value'
    )
  } else {
    await user.type(within(dialog).getByLabelText('CONTEÚDO'), 'text content')
  }
  await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))
  return { dialog, user }
}

describe('create item errors', () => {
  it('prioritizes the network warning for text items', async () => {
    apiMocks.itemsCreate.mockRejectedValue(
      new ApiError('server detail', undefined, undefined, undefined, {
        networkError: true,
      })
    )
    const { dialog } = await submitItem('text')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar o cadastro. Confira se o item foi criado antes de tentar novamente.'
    )
  })

  it('uses the secret-specific network warning before server details', async () => {
    apiMocks.itemsCreate.mockRejectedValueOnce(
      new ApiError('server detail', undefined, undefined, undefined, {
        networkError: true,
      })
    )
    const { dialog } = await submitItem('secret')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível confirmar o cadastro do segredo. Confira se ele foi criado antes de tentar novamente.'
    )
    expect(within(dialog).queryByText('server detail')).toBeNull()
  })

  it('uses the conflict message for text items and keeps the dialog open', async () => {
    apiMocks.itemsCreate.mockRejectedValue(
      new ApiError('Detalhe do servidor', 409)
    )
    const { dialog } = await submitItem('text')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe um item com esse título nessa localização.'
    )
    expect(dialog).toBeInTheDocument()
    expect(apiMocks.itemsCreate).toHaveBeenCalledOnce()
  })

  it('preserves the mapped conflict message for secret creation', async () => {
    apiMocks.itemsCreate.mockRejectedValue(
      new ApiError('Sensitive server detail', 409)
    )
    const { dialog } = await submitItem('secret')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe um item com esse título nessa localização.'
    )
    expect(within(dialog).queryByText('Sensitive server detail')).toBeNull()
  })

  it('explains when the server has no secret encryption configured', async () => {
    apiMocks.itemsCreate.mockRejectedValueOnce(
      new ApiError('SECRET_ENCRYPTION_KEY não configurada', 503)
    )
    const { dialog } = await submitItem('secret')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'O armazenamento de segredos não está configurado no servidor. Avise o administrador.'
    )
    expect(
      within(dialog).queryByText('SECRET_ENCRYPTION_KEY não configurada')
    ).toBeNull()
  })

  it('tells the user when secret creation is forbidden', async () => {
    apiMocks.itemsCreate.mockRejectedValueOnce(new ApiError('Forbidden', 403))
    const { dialog } = await submitItem('secret')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para criar segredos neste workspace.'
    )
  })

  it('uses the generic message for other secret failures without exposing server details', async () => {
    apiMocks.itemsCreate.mockRejectedValueOnce(
      new ApiError('Sensitive server detail', 500)
    )
    const { dialog } = await submitItem('secret')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar o segredo. Verifique sua permissão e tente novamente.'
    )
    expect(within(dialog).queryByText('Sensitive server detail')).toBeNull()
  })

  it('shows a non-secret server message for an unmapped status', async () => {
    apiMocks.itemsCreate.mockRejectedValueOnce(
      new ApiError('Detalhe do servidor', 422)
    )
    const { dialog } = await submitItem('text')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Detalhe do servidor'
    )
  })

  it('uses the generic fallback when the error has no message', async () => {
    apiMocks.itemsCreate.mockRejectedValueOnce(new ApiError(String(), 422))
    const { dialog } = await submitItem('text')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível criar o item.'
    )
  })
})

describe('document item creation', () => {
  it('uploads one supported file with its title and description', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' })
    )
    await user.type(
      within(dialog).getByLabelText('DESCRIÇÃO (OPCIONAL)'),
      'Current policy'
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    await waitFor(() =>
      expect(apiMocks.createAttachment).toHaveBeenCalledOnce()
    )
    const [calledWorkspace, payload, options] =
      apiMocks.createAttachment.mock.calls[0]
    expect(calledWorkspace).toBe(workspaceId)
    expect(payload.title).toBe('Policy')
    expect(payload.description).toBe('Current policy')
    expect(payload.file).toMatchObject({ name: 'policy.pdf' })
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(apiMocks.itemsCreate).not.toHaveBeenCalled()
  })

  it('rejects unsupported files before calling the attachment API', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['program'], 'malware.exe', {
        type: 'application/octet-stream',
      })
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Formato não suportado'
    )
    expect(apiMocks.createAttachment).not.toHaveBeenCalled()
  })

  it('shows upload progress and aborts the active upload on cancel', async () => {
    apiMocks.createAttachment.mockImplementation(
      (_workspace, _form, uploadOptions) => {
        uploadOptions.onUploadProgress(43)
        return new Promise((_resolve, reject) => {
          uploadOptions.signal.addEventListener(
            'abort',
            () =>
              reject(
                new ApiError('Canceled', undefined, undefined, undefined, {
                  canceled: true,
                })
              ),
            { once: true }
          )
        })
      }
    )
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' })
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    await waitFor(() =>
      expect(apiMocks.createAttachment).toHaveBeenCalledOnce()
    )
    expect(within(dialog).getByText('Envio: 43%')).toBeInTheDocument()
    const [, , options] = apiMocks.createAttachment.mock.calls[0]
    await user.click(
      within(dialog).getByRole('button', { name: 'CANCELAR ENVIO' })
    )
    expect(options.signal.aborted).toBe(true)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Envio cancelado. Confira se o item foi criado antes de tentar novamente.'
    )
    await waitFor(() => {
      expect(
        within(dialog).queryByRole('button', { name: 'CANCELAR ENVIO' })
      ).toBeNull()
    })
    expect(
      within(dialog).getByRole('button', { name: 'CANCELAR' })
    ).toBeEnabled()
    expect(within(dialog).queryByText('Envio: 43%')).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'texto' })).toBeEnabled()
    expect(dialog).toBeInTheDocument()
  })

  it('unlocks the form and keeps the dialog open after a non-canceled upload failure', async () => {
    apiMocks.createAttachment.mockRejectedValue(
      new ApiError('Detalhe do servidor', 409)
    )
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' })
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe um item com esse título nessa localização.'
    )
    expect(dialog).toBeInTheDocument()
    expect(apiMocks.createAttachment).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'texto' })
      ).toBeEnabled()
    })
    expect(
      within(dialog).queryByRole('button', { name: 'CANCELAR ENVIO' })
    ).toBeNull()
    expect(
      within(dialog).getByRole('button', { name: 'CANCELAR' })
    ).toBeEnabled()
  })

  it('keeps the description when switching file to text and back to file', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.type(
      within(dialog).getByLabelText('DESCRIÇÃO (OPCIONAL)'),
      'Current policy'
    )
    await user.click(within(dialog).getByRole('button', { name: 'texto' }))
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))

    expect(within(dialog).getByLabelText('DESCRIÇÃO (OPCIONAL)')).toHaveValue(
      'Current policy'
    )
  })

  it('shows the missing file error and focuses the file input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Selecione um arquivo.'
    )
    expect(within(dialog).getByLabelText('ARQUIVO')).toHaveFocus()
    expect(apiMocks.createAttachment).not.toHaveBeenCalled()
  })

  it('focuses the file input when the selected file is invalid', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['program'], 'malware.exe', {
        type: 'application/octet-stream',
      })
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    await within(dialog).findByRole('alert')
    expect(within(dialog).getByLabelText('ARQUIVO')).toHaveFocus()
  })

  it('disables CANCELAR while a non-file item is being submitted', async () => {
    apiMocks.itemsCreate.mockReturnValue(new Promise(() => undefined))
    const { dialog } = await submitItem('text')

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'CANCELAR' })
      ).toBeDisabled()
    )
    expect(
      within(dialog).queryByRole('button', { name: 'CANCELAR ENVIO' })
    ).toBeNull()
  })

  it('discards a selected attachment when switching back to a text item', async () => {
    apiMocks.itemsCreate.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Notes')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' })
    )
    await user.click(within(dialog).getByRole('button', { name: 'texto' }))
    await user.type(within(dialog).getByLabelText('CONTEÚDO'), 'Text content')
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    await waitFor(() => expect(apiMocks.itemsCreate).toHaveBeenCalledOnce())
    expect(apiMocks.createAttachment).not.toHaveBeenCalled()
  })

  it('keeps the type selector locked and progress visible while uploading', async () => {
    apiMocks.createAttachment.mockImplementation(
      (_workspace, _form, uploadOptions) => {
        uploadOptions.onUploadProgress(61)
        return new Promise(() => undefined)
      }
    )
    const user = userEvent.setup()
    renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' })
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    expect(await within(dialog).findByText('Envio: 61%')).toBeInTheDocument()
    for (const name of ['documento', 'link', 'segredo', 'texto']) {
      expect(within(dialog).getByRole('button', { name })).toBeDisabled()
    }
    expect(
      within(dialog).getByRole('button', { name: 'CANCELAR ENVIO' })
    ).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'texto' }))
    expect(
      within(dialog).getByRole('button', { name: 'documento' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText('Envio: 61%')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'CANCELAR ENVIO' })
    ).toBeEnabled()
  })

  it('closes the dialog and notifies the parent after a successful upload', async () => {
    const onItemCreated = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <CreateItemDialog
        onItemCreated={onItemCreated}
        workspaceId={workspaceId}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('TÍTULO'), 'Policy')
    await user.click(within(dialog).getByRole('button', { name: 'documento' }))
    await user.upload(
      within(dialog).getByLabelText('ARQUIVO'),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' })
    )
    await user.click(within(dialog).getByRole('button', { name: 'CRIAR' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(onItemCreated).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    const reopened = await screen.findByRole('dialog')
    expect(within(reopened).getByLabelText('TÍTULO')).toHaveValue('')
    expect(
      within(reopened).getByRole('button', { name: 'texto' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(reopened).queryByRole('button', { name: 'CANCELAR ENVIO' })
    ).toBeNull()
  })
})

it('hides secret creation when only ordinary item creation is granted', async () => {
  apiMocks.workspacePermissions.mockResolvedValue({
    data: {
      isOwner: false,
      permissions: [{ action: 'create', resource: 'item' }],
    },
  })
  const user = userEvent.setup()
  renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
  await user.click(screen.getByRole('button', { name: 'Novo item' }))
  const create = await screen.findByRole('button', { name: 'CRIAR' })
  await waitFor(() => expect(create).toBeEnabled())
  expect(screen.queryByRole('button', { name: 'segredo' })).toBeNull()
  expect(apiMocks.collectionsList).not.toHaveBeenCalled()
})
