import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  request: vi.fn(),
}))

vi.mock('./client', () => ({
  apiClient: apiMocks,
}))

import { itemsApi } from './endpoints'

afterEach(() => vi.clearAllMocks())

const file = new File(['conteudo'], 'doc.pdf', { type: 'application/pdf' })
const options = {
  onUploadProgress: vi.fn(),
  signal: new AbortController().signal,
}

function sentForm() {
  const [config] = apiMocks.request.mock.calls[0] ?? []
  return config.data as FormData
}

describe('itemsApi attachments', () => {
  it('createAttachment envia multipart com título, arquivo e opcionais', async () => {
    apiMocks.request.mockResolvedValue({ data: {} })

    await itemsApi.createAttachment(
      'ws-1',
      {
        collectionId: 'col-1',
        description: 'Descrição',
        file,
        title: 'Política',
      },
      options
    )

    const [config] = apiMocks.request.mock.calls[0] ?? []
    expect(config.method).toBe('post')
    expect(config.url).toBe('/workspaces/ws-1/items/attachments')
    expect(config.signal).toBe(options.signal)
    const form = sentForm()
    expect(form.get('title')).toBe('Política')
    expect(form.get('file')).toBeInstanceOf(File)
    expect((form.get('file') as File).name).toBe('doc.pdf')
    expect(form.get('description')).toBe('Descrição')
    expect(form.get('collectionId')).toBe('col-1')
  })

  it('createAttachment omite description e collectionId vazios ou ausentes', async () => {
    apiMocks.request.mockResolvedValue({ data: {} })

    await itemsApi.createAttachment(
      'ws-1',
      { collectionId: '', description: '', file, title: 'Política' },
      options
    )

    const form = sentForm()
    expect(form.has('description')).toBe(false)
    expect(form.has('collectionId')).toBe(false)
    expect(form.get('title')).toBe('Política')
  })

  it('traduz o progresso do upload em porcentagem inteira', async () => {
    apiMocks.request.mockResolvedValue({ data: {} })
    await itemsApi.createAttachment('ws-1', { file, title: 'T' }, options)
    const [config] = apiMocks.request.mock.calls[0] ?? []

    config.onUploadProgress({ progress: 0.456 })
    config.onUploadProgress({})

    expect(options.onUploadProgress).toHaveBeenNthCalledWith(1, 46)
    expect(options.onUploadProgress).toHaveBeenNthCalledWith(2, 0)
  })

  it('replaceAttachment usa PUT com o arquivo e aceita opções ausentes', async () => {
    apiMocks.request.mockResolvedValue({ data: {} })

    await itemsApi.replaceAttachment('ws-1', 'item-1', file)

    const [config] = apiMocks.request.mock.calls[0] ?? []
    expect(config.method).toBe('put')
    expect(config.url).toBe('/workspaces/ws-1/items/item-1/attachment')
    expect(config.signal).toBeUndefined()
    expect((sentForm().get('file') as File).name).toBe('doc.pdf')
    expect(() => config.onUploadProgress({ progress: 1 })).not.toThrow()
  })

  it('downloadAttachment busca o blob sem parâmetro de query', async () => {
    apiMocks.get.mockResolvedValue({ data: new Blob() })

    await itemsApi.downloadAttachment('ws-1', 'item-1')

    expect(apiMocks.get).toHaveBeenCalledWith(
      '/workspaces/ws-1/items/item-1/attachment',
      { responseType: 'blob' }
    )
  })
})
