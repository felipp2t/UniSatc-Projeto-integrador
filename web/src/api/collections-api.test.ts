import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('./client', () => ({
  apiClient: apiMocks,
}))

import { collectionsApi } from './endpoints'

afterEach(() => vi.clearAllMocks())

describe('collectionsApi mutations', () => {
  it('creates a collection with its name and optional parent', async () => {
    const response = {
      data: { id: 'new-id', name: 'Docs', parentId: 'parent' },
    }
    apiMocks.post.mockResolvedValue(response)

    await expect(
      collectionsApi.create('workspace-id', {
        name: 'Docs',
        parentId: 'parent',
      })
    ).resolves.toBe(response)
    expect(apiMocks.post).toHaveBeenCalledWith(
      '/workspaces/workspace-id/collections',
      { name: 'Docs', parentId: 'parent' }
    )
  })

  it('renames a collection', async () => {
    const response = {
      data: { id: 'collection-id', name: 'Archive', parentId: null },
    }
    apiMocks.put.mockResolvedValue(response)

    await expect(
      collectionsApi.rename('workspace-id', 'collection-id', {
        name: 'Archive',
      })
    ).resolves.toBe(response)
    expect(apiMocks.put).toHaveBeenCalledWith(
      '/workspaces/workspace-id/collections/collection-id',
      { name: 'Archive' }
    )
  })

  it('deletes a collection', async () => {
    const response = { data: undefined }
    apiMocks.delete.mockResolvedValue(response)

    await expect(
      collectionsApi.remove('workspace-id', 'collection-id')
    ).resolves.toBe(response)
    expect(apiMocks.delete).toHaveBeenCalledWith(
      '/workspaces/workspace-id/collections/collection-id'
    )
  })
})
