import { describe, expect, it } from 'vitest'
import { getMemberPermissions, isWorkspaceOwner } from './member-permissions'

describe('workspace member permissions', () => {
  it('recognizes only the exact Owner role returned by the server', () => {
    expect(isWorkspaceOwner('Owner')).toBe(true)
    expect(isWorkspaceOwner('owner')).toBe(false)
    expect(isWorkspaceOwner(undefined)).toBe(false)
  })

  it('allows co-owners to remove other members when supported by the API', () => {
    expect(
      getMemberPermissions({
        currentUserRole: 'Owner',
        memberRoleName: 'member',
        ownerCount: 2,
      })
    ).toEqual({
      removeReason: 'A remoção ainda não está disponível na API do servidor.',
    })
  })

  it('denies removal when the current member is not an Owner', () => {
    expect(
      getMemberPermissions({
        currentUserRole: 'member',
        memberRoleName: 'Owner',
        ownerCount: 1,
      })
    ).toEqual({
      removeReason: 'Somente um dono pode remover membros.',
    })
  })

  it('protects the last Owner from removal', () => {
    expect(
      getMemberPermissions({
        currentUserRole: 'Owner',
        memberRoleName: 'Owner',
        ownerCount: 1,
      })
    ).toEqual({
      removeReason: 'O último dono do workspace não pode ser removido.',
    })
  })
})
