import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('./client', () => ({ apiClient: apiMocks }))

import {
  globalRoleApi,
  publicationApi,
  receivedContentApi,
  workspaceApi,
  workspaceTeamsApi,
} from './endpoints'

const workspaceId = '00000000-0000-4000-8000-000000000001'
const teamId = '00000000-0000-4000-8000-000000000002'
const collectionId = '00000000-0000-4000-8000-000000000003'
const memberId = '00000000-0000-4000-8000-000000000004'

afterEach(() => vi.clearAllMocks())

describe('fixed workspace role and team API contracts', () => {
  it('parses members with fixed roles and nullable team membership', async () => {
    const member = {
      email: 'ana@example.com',
      globalRole: 'ADMIN',
      id: memberId,
      isTeamLeader: true,
      name: 'Ana',
      roleName: 'Owner',
      teamId,
      userId: memberId,
    }
    apiMocks.get.mockResolvedValue({ data: [member] })

    await expect(workspaceApi.listMembers(workspaceId)).resolves.toMatchObject({
      data: [member],
    })
    expect(apiMocks.get).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/members`
    )
  })

  it('rejects incomplete member role and team fields', async () => {
    apiMocks.get.mockResolvedValue({
      data: [{ id: memberId, name: 'Ana', userId: memberId }],
    })
    await expect(workspaceApi.listMembers(workspaceId)).rejects.toThrow(
      'A resposta da API contém membros inválidos.'
    )
  })

  it('assigns or clears only the supported global roles', async () => {
    apiMocks.put.mockResolvedValue({ data: undefined })

    await globalRoleApi.assign(workspaceId, memberId, 'MAINTAINER')
    await globalRoleApi.assign(workspaceId, memberId, null)

    expect(apiMocks.put).toHaveBeenNthCalledWith(
      1,
      `/workspaces/${workspaceId}/members/${memberId}/role`,
      { globalRole: 'MAINTAINER' }
    )
    expect(apiMocks.put).toHaveBeenNthCalledWith(
      2,
      `/workspaces/${workspaceId}/members/${memberId}/role`,
      { globalRole: null }
    )
  })

  it('transfers workspace ownership to a membership', async () => {
    apiMocks.put.mockResolvedValue({ data: undefined })

    await workspaceApi.transferOwnership(workspaceId, memberId)

    expect(apiMocks.put).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/members/transfer-owner`,
      { memberId }
    )
  })

  it('sends team membership changes using workspace membership IDs', async () => {
    apiMocks.post.mockResolvedValue({ data: undefined })
    apiMocks.delete.mockResolvedValue({ data: undefined })

    await workspaceTeamsApi.addMember(workspaceId, teamId, memberId)
    await workspaceTeamsApi.removeMember(workspaceId, teamId, memberId)

    expect(apiMocks.post).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/teams/${teamId}/members`,
      { workspaceMemberId: memberId }
    )
    expect(apiMocks.delete).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/teams/${teamId}/members/${memberId}`
    )
  })

  it('rejects malformed team responses', async () => {
    apiMocks.get.mockResolvedValue({ data: [{ id: 'bad-id' }] })

    await expect(workspaceTeamsApi.list(workspaceId)).rejects.toThrow(
      'A resposta da API contém times inválidos.'
    )
  })
})

describe('publication and received content API contracts', () => {
  it('publishes and revokes content through publication endpoints', async () => {
    const publication = {
      capturedPath: 'Produto/Chaves',
      createdAt: '2026-11-05T10:00:00Z',
      destinationCollectionId: collectionId,
      id: memberId,
      originalId: collectionId,
      originalType: 'COLLECTION',
      sourceCollectionId: collectionId,
      sourceTeamName: 'Produto',
    }
    apiMocks.post.mockResolvedValue({ data: publication })
    apiMocks.delete.mockResolvedValue({ data: undefined })

    await expect(
      publicationApi.publish(workspaceId, {
        destinationTeamId: teamId,
        originalId: collectionId,
        originalType: 'COLLECTION',
      })
    ).resolves.toMatchObject({ data: publication })
    await publicationApi.revoke(workspaceId, memberId)

    expect(apiMocks.post).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/sharing/publications`,
      {
        destinationTeamId: teamId,
        originalId: collectionId,
        originalType: 'COLLECTION',
      }
    )
    expect(apiMocks.delete).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/sharing/publications/${memberId}`
    )
  })

  it('passes received search pagination and abort signal to the API', async () => {
    const page = { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 }
    const { signal } = new AbortController()
    apiMocks.get.mockResolvedValue({ data: page })

    await expect(
      receivedContentApi.list(
        workspaceId,
        { page: 0, q: 'token', size: 20 },
        signal
      )
    ).resolves.toMatchObject({ data: page })
    expect(apiMocks.get).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/received`,
      { params: { page: 0, q: 'token', size: 20 }, signal }
    )
  })

  it('rejects malformed received content pages', async () => {
    apiMocks.get.mockResolvedValue({ data: { items: [] } })

    await expect(receivedContentApi.list(workspaceId, {})).rejects.toThrow(
      'Conteúdo recebido inválido.'
    )
  })
})
