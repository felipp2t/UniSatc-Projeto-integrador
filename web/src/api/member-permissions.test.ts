import { describe, expect, it } from 'vitest'
import { getMemberPermissions, isOwnerRole } from './member-permissions'

describe('workspace member permissions', () => {
  it('recognizes only the exact Owner role returned by the server', () => {
    expect(isOwnerRole('Owner')).toBe(true)
    expect(isOwnerRole('owner')).toBe(false)
    expect(isOwnerRole(undefined)).toBe(false)
  })

  it('allows co-owners to remove other members when supported by the API', () => {
    expect(
      getMemberPermissions({
        currentUserRole: 'Owner',
        memberRoleName: 'Member',
        ownerCount: 2,
      })
    ).toEqual({
      isLastOwner: false,
      removeReason: 'A remoção ainda não está disponível na API do servidor.',
    })
  })

  it('denies removal when the current member is not an Owner', () => {
    expect(
      getMemberPermissions({
        currentUserRole: 'Member',
        memberRoleName: 'Owner',
        ownerCount: 1,
      })
    ).toEqual({
      isLastOwner: true,
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
      isLastOwner: true,
      removeReason: 'O último dono do workspace não pode ser removido.',
    })
  })

  it.each([
    ['the only Owner', 'Owner', 1, true],
    ['one of two Owners', 'Owner', 2, false],
    ['a non-Owner member', 'Member', 1, false],
    ['a non-Owner member among many Owners', 'Member', 3, false],
    ['a lower-case owner role', 'owner', 1, false],
  ])(
    'flags isLastOwner for %s',
    (_label, memberRoleName, ownerCount, expected) => {
      expect(
        getMemberPermissions({
          currentUserRole: 'Owner',
          memberRoleName,
          ownerCount,
        }).isLastOwner
      ).toBe(expected)
    }
  )
})
