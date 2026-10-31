import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('./client', () => ({ apiClient: apiMocks }))

import { workspaceApi } from './endpoints'

const validMember = {
  id: 'membership-local-1',
  name: 'Ana Silva',
  roleId: 'role-local-owner',
  roleName: 'Owner',
  userId: 'user-local-1',
}

afterEach(() => vi.clearAllMocks())

describe('workspaceApi member contracts', () => {
  it('accepts optional emails and non-UUID string identifiers', async () => {
    const response = {
      data: [{ ...validMember, email: 'ana@example.com' }, validMember],
    }
    apiMocks.get.mockResolvedValue(response)

    const result = await workspaceApi.listMembers('workspace-local')
    expect(result.data).toEqual([
      { ...validMember, email: 'ana@example.com' },
      validMember,
    ])
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/workspaces/workspace-local/members'
    )
  })

  it('lists valid workspace roles from the workspace role catalog', async () => {
    const roles = [
      { id: 'role-owner', name: 'Owner' },
      { id: 'role-member', name: 'Member' },
    ]
    apiMocks.get.mockResolvedValue({ data: roles })

    await expect(
      workspaceApi.listRoles('workspace-local')
    ).resolves.toMatchObject({ data: roles })
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/workspaces/workspace-local/roles'
    )
  })

  it('ignores extra role fields and keeps only id and name', async () => {
    apiMocks.get.mockResolvedValue({
      data: [
        { builtIn: true, id: 'role-owner', memberCount: 2, name: 'Owner' },
        { id: 'role-member', name: 'Member' },
      ],
    })

    const result = await workspaceApi.listRoles('workspace-local')
    expect(result.data).toEqual([
      { id: 'role-owner', name: 'Owner' },
      { id: 'role-member', name: 'Member' },
    ])
  })

  it.each([
    ['an empty ID', { id: '', name: 'Owner' }],
    ['an empty name', { id: 'role-owner', name: '' }],
    ['a missing name', { id: 'role-owner' }],
  ])('rejects a role with %s', async (_reason, invalidRole) => {
    apiMocks.get.mockResolvedValue({ data: [invalidRole] })

    await expect(workspaceApi.listRoles('workspace-local')).rejects.toThrow(
      'A resposta da API contém cargos inválidos.'
    )
  })

  it('changes a member role with the membership ID and validates the response', async () => {
    apiMocks.put.mockResolvedValue({ data: validMember })

    await expect(
      workspaceApi.changeMemberRole(
        'workspace-local',
        'membership-local-1',
        'role-member'
      )
    ).resolves.toMatchObject({ data: validMember })
    expect(apiMocks.put).toHaveBeenCalledWith(
      '/workspaces/workspace-local/members/membership-local-1/role',
      { roleId: 'role-member' }
    )
  })

  it('rejects an invalid member role response', async () => {
    apiMocks.put.mockResolvedValue({ data: { ...validMember, roleId: '' } })

    await expect(
      workspaceApi.changeMemberRole(
        'workspace-local',
        'membership-local-1',
        'role-member'
      )
    ).rejects.toThrow('A resposta da API contém um membro inválido.')
  })

  it.each([
    ['a missing role ID', { ...validMember, roleId: undefined }],
    ['an empty user ID', { ...validMember, userId: '' }],
    ['an empty member name', { ...validMember, name: '' }],
    ['an invalid email', { ...validMember, email: 42 }],
  ])(
    'rejects the entire response when one member has %s',
    async (_reason, invalidMember) => {
      apiMocks.get.mockResolvedValue({ data: [validMember, invalidMember] })

      await expect(workspaceApi.listMembers('workspace-local')).rejects.toThrow(
        'A resposta da API contém membros inválidos.'
      )
    }
  )
})
