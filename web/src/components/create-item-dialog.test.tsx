// @vitest-environment happy-dom

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  collectionsList: vi.fn(),
  itemsCreate: vi.fn(),
  workspaceList: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: {
      ...actual.collectionsApi,
      list: apiMocks.collectionsList,
    },
    itemsApi: { ...actual.itemsApi, create: apiMocks.itemsCreate },
    workspaceApi: { ...actual.workspaceApi, list: apiMocks.workspaceList },
  }
})

import { CreateItemDialog } from './create-item-dialog'

const workspaceId = 'workspace-1'

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.collectionsList.mockResolvedValue({
    data: { items: [], page: 0, size: 100, totalItems: 0, totalPages: 1 },
  })
  apiMocks.workspaceList.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace' }],
  })
  apiMocks.itemsCreate.mockRejectedValue(new Error('Unexpected test setup'))
})

afterEach(() => vi.restoreAllMocks())

async function submitItem(type: 'secret' | 'text') {
  const user = userEvent.setup()
  renderWithProviders(<CreateItemDialog workspaceId={workspaceId} />)
  await user.click(screen.getByRole('button', { name: 'Novo item' }))
  const dialog = await screen.findByRole('dialog')
  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: 'CREATE' })).toBeEnabled()
  })
  await user.type(within(dialog).getByLabelText('TITLE'), 'Test item')
  if (type === 'secret') {
    await user.click(within(dialog).getByRole('button', { name: 'secret' }))
    await user.type(
      within(dialog).getByLabelText('SECRET VALUE'),
      'secret value'
    )
  } else {
    await user.type(within(dialog).getByLabelText('CONTENT'), 'text content')
  }
  await user.click(within(dialog).getByRole('button', { name: 'CREATE' }))
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
