// @vitest-environment happy-dom

import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemKeys } from '@/api/item-keys'
import type { ItemResponse } from '@/api/types'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  download: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      downloadAttachment: apiMocks.download,
    },
  }
})

import { ItemAttachmentDialog } from './item-attachment-dialog'

const SUBSTITUIR_OR_SAVE = /substituir|salvar/i
const workspaceId = 'workspace-1'
const item: ItemResponse = {
  archivedAt: null,
  collectionId: null,
  description: null,
  id: 'item-1',
  linkUrl: null,
  preview: null,
  textContent: null,
  title: 'Policy',
  type: 'file',
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.download.mockResolvedValue({ data: new Blob(['old file']) })
})

afterEach(() => vi.restoreAllMocks())

describe('item attachment dialog', () => {
  it('downloads a PDF without preview and previews later from the same response', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank')
    let finishDownload: (() => void) | undefined
    apiMocks.download.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDownload = () =>
            resolve({
              data: new Blob(['pdf'], { type: 'application/pdf' }),
              headers: {
                'content-disposition':
                  "attachment; filename*=UTF-8''policy%20final.pdf",
                'content-type': 'application/pdf',
              },
            })
        })
    )
    const clickedAnchors: HTMLAnchorElement[] = []
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedAnchors.push(this)
      })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(apiMocks.download).not.toHaveBeenCalled()
    const downloadButton = within(dialog).getByRole('button', {
      name: 'Baixar arquivo',
    })
    await user.click(downloadButton)
    expect(apiMocks.download).toHaveBeenCalledOnce()
    await act(async () => finishDownload?.())
    expect(
      within(dialog).queryByTitle('Visualização de Policy')
    ).not.toBeInTheDocument()
    expect(apiMocks.download).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(clickedAnchors[0]?.download).toBe('policy final.pdf')

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(
      await within(dialog).findByTitle('Visualização de Policy')
    ).toBeInTheDocument()
    expect(apiMocks.download).toHaveBeenCalledOnce()
  })
  it('labels the trigger according to the item type', () => {
    const { queryClient, rerender } = renderWithProviders(
      <ItemAttachmentDialog
        item={{ ...item, type: 'image' }}
        workspaceId={workspaceId}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Abrir imagem Policy' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Abrir documento Policy' })
    ).toBeNull()

    rerender(
      <QueryClientProvider client={queryClient}>
        <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
      </QueryClientProvider>
    )
    expect(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    ).toBeInTheDocument()
  })
  it('revokes the download object URL only after the 30 s delay', async () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('about:blank')
      .mockReturnValueOnce('blob:download')
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    apiMocks.download.mockResolvedValue({
      data: new Blob(['pdf'], { type: 'application/pdf' }),
      headers: {},
    })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(apiMocks.download).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    await within(dialog).findByTitle('Visualização de Policy')

    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Baixar arquivo' })
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(click).toHaveBeenCalledOnce()
      expect(revoke).not.toHaveBeenCalledWith('blob:download')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_999)
      })
      expect(revoke).not.toHaveBeenCalledWith('blob:download')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(revoke).toHaveBeenCalledWith('blob:download')
    } finally {
      vi.useRealTimers()
    }
  })
  it('shows image previews and does not preview other document types', async () => {
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('about:blank')
    apiMocks.download.mockResolvedValue({
      data: new Blob(['image'], { type: 'image/png' }),
      headers: {},
    })
    const user = userEvent.setup()
    const { queryClient, rerender } = renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const firstDialog = await screen.findByRole('dialog')
    expect(apiMocks.download).not.toHaveBeenCalled()
    expect(within(firstDialog).queryByRole('img')).toBeNull()
    await user.click(
      within(firstDialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(
      await within(firstDialog).findByRole('img', { name: item.title })
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')

    apiMocks.download.mockResolvedValue({
      data: new Blob(['document'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      headers: {},
    })
    rerender(
      <QueryClientProvider client={queryClient}>
        <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
      </QueryClientProvider>
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(apiMocks.download).toHaveBeenCalledOnce()
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(within(dialog).queryByRole('img')).toBeNull()
    expect(within(dialog).queryByTitle('Visualização de Policy')).toBeNull()
  })
  it('revokes the preview URL when the dialog closes', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    apiMocks.download.mockResolvedValue({
      data: new Blob(['image'], { type: 'image/png' }),
      headers: {},
    })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(apiMocks.download).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(
      await within(dialog).findByRole('img', { name: item.title })
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:preview'))
  })
  it('keeps preview available and retries a failed preview request', async () => {
    apiMocks.download
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        data: new Blob(['image'], { type: 'image/png' }),
        headers: {},
      })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(apiMocks.download).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o anexo para visualização.'
    )
    const previewButton = within(dialog).getByRole('button', {
      name: 'Visualizar ou tentar novamente (PDF/imagem)',
    })
    expect(previewButton).toBeInTheDocument()
    await user.click(previewButton)
    await waitFor(() => expect(apiMocks.download).toHaveBeenCalledTimes(2))
    expect(
      await within(dialog).findByRole('img', { name: item.title })
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })
  it('retries a failed attachment GET from the download button', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank')
    apiMocks.download
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        data: new Blob(['image'], { type: 'image/png' }),
        headers: { 'content-type': 'image/png' },
      })
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(apiMocks.download).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o anexo para visualização.'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Baixar arquivo' })
    )

    expect(
      await within(dialog).findByRole('img', { name: item.title })
    ).toBeInTheDocument()
    await waitFor(() => expect(apiMocks.download).toHaveBeenCalledTimes(2))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(clicked).toHaveBeenCalledOnce()
  })
  it('reuses the cached attachment for download after previewing', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank')
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    apiMocks.download.mockResolvedValue({
      data: new Blob(['image'], { type: 'image/png' }),
      headers: {},
    })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog
        item={{ ...item, type: 'image' }}
        workspaceId={workspaceId}
      />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir imagem Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('img', { name: item.title })

    await user.click(
      within(dialog).getByRole('button', { name: 'Baixar arquivo' })
    )

    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(apiMocks.download).toHaveBeenCalledOnce()
  })
  it('shows an error when the download fails', async () => {
    apiMocks.download.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')

    await user.click(
      within(dialog).getByRole('button', { name: 'Baixar arquivo' })
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível baixar o anexo.'
    )
  })
  it('falls back to the title when the response has no filename', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank')
    const anchors: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      anchors.push(this)
    })
    apiMocks.download.mockResolvedValue({
      data: new Blob(['x']),
      headers: {},
    })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')

    await user.click(
      within(dialog).getByRole('button', { name: 'Baixar arquivo' })
    )

    await waitFor(() => expect(anchors).toHaveLength(1))
    expect(anchors[0]?.download).toBe('Policy')
  })
  it('lets archived items be viewed and downloaded with no edit controls', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank')
    apiMocks.download.mockResolvedValue({
      data: new Blob(['pdf'], { type: 'application/pdf' }),
      headers: {},
    })
    const user = userEvent.setup()
    renderWithProviders(
      <ItemAttachmentDialog
        item={{ ...item, archivedAt: '2026-01-01T00:00:00Z' }}
        workspaceId={workspaceId}
      />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')

    expect(
      within(dialog).getByRole('button', { name: 'Baixar arquivo' })
    ).toBeEnabled()
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    expect(
      await within(dialog).findByTitle('Visualização de Policy')
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: SUBSTITUIR_OR_SAVE })
    ).toBeNull()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
  })
  it('refetches the attachment after its query is invalidated', async () => {
    apiMocks.download
      .mockResolvedValueOnce({
        data: new Blob(['v1'], { type: 'text/plain' }),
        headers: {},
      })
      .mockResolvedValueOnce({
        data: new Blob(['v2'], { type: 'image/png' }),
        headers: {},
      })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('about:blank')
    const user = userEvent.setup()
    const { queryClient } = renderWithProviders(
      <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
    )
    await user.click(
      screen.getByRole('button', { name: 'Abrir documento Policy' })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Visualizar ou tentar novamente (PDF/imagem)',
      })
    )
    await waitFor(() => expect(apiMocks.download).toHaveBeenCalledOnce())

    await act(() =>
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) })
    )

    expect(
      await within(dialog).findByRole('img', { name: item.title })
    ).toBeInTheDocument()
    expect(apiMocks.download).toHaveBeenCalledTimes(2)
  })
})
