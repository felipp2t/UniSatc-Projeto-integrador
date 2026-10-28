import { describe, expect, it } from 'vitest'
import {
  getMemberPermissions,
  MEMBER_MANAGEMENT_AVAILABLE,
} from './member-permissions'

describe('workspace member permissions', () => {
  it('allows the canonical owner to request changes for another member', () => {
    expect(
      getMemberPermissions({
        currentUserId: 'owner',
        managementAvailable: true,
        memberUserId: 'member',
        workspaceOwnerId: 'owner',
      })
    ).toMatchObject({
      canChangeRole: true,
      canRemove: true,
      canRequestRemoval: true,
      changeRoleReason: undefined,
      isOwner: true,
      isSelf: false,
      removeReason: undefined,
    })
  })

  it('protects the workspace owner ID even when management is available', () => {
    expect(
      getMemberPermissions({
        currentUserId: 'owner',
        managementAvailable: true,
        memberUserId: 'owner',
        workspaceOwnerId: 'owner',
      })
    ).toMatchObject({
      canChangeRole: false,
      canRemove: false,
      canRequestRemoval: false,
      isLastOwner: true,
      isSelf: true,
      removeReason: 'O último dono do workspace não pode ser removido.',
    })
  })

  it('preserves the owner request while disabling confirmation without API support', () => {
    expect(MEMBER_MANAGEMENT_AVAILABLE).toBe(false)
    expect(
      getMemberPermissions({
        currentUserId: 'owner',
        memberUserId: 'member',
        workspaceOwnerId: 'owner',
      })
    ).toMatchObject({
      canChangeRole: false,
      canRemove: false,
      canRequestRemoval: true,
      changeRoleReason:
        'A alteração de cargo ainda não está disponível na API.',
      removeReason: 'A remoção ainda não está disponível na API do servidor.',
    })
  })

  it('prioritizes self and last-owner explanations over API availability', () => {
    const self = getMemberPermissions({
      currentUserId: 'owner',
      memberUserId: 'owner',
      workspaceOwnerId: 'owner',
    })
    expect(self.changeRoleReason).toBe('Você não pode alterar o próprio cargo.')
    expect(self.removeReason).toBe(
      'O último dono do workspace não pode ser removido.'
    )
  })

  it('denies management to a non-owner', () => {
    expect(
      getMemberPermissions({
        currentUserId: 'member',
        managementAvailable: true,
        memberUserId: 'other',
        workspaceOwnerId: 'owner',
      })
    ).toMatchObject({
      canChangeRole: false,
      canRemove: false,
      canRequestRemoval: false,
      changeRoleReason: 'Somente um dono pode alterar cargos.',
      removeReason: 'Somente um dono pode remover membros.',
    })
  })
})
