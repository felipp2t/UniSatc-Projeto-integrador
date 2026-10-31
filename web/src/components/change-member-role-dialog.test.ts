import { describe, expect, it } from 'vitest'
import { getRoleChangeDescription } from '@/components/change-member-role-dialog'

describe('getRoleChangeDescription', () => {
  it('describes the change without a warning', () => {
    expect(
      getRoleChangeDescription({
        losesOwnManagement: false,
        memberName: 'Bia',
        roleName: 'Owner',
      })
    ).toBe('Alterar o cargo de Bia para Owner?')
  })

  it('appends the management warning when the user loses access', () => {
    expect(
      getRoleChangeDescription({
        losesOwnManagement: true,
        memberName: 'Ana',
        roleName: 'Member',
      })
    ).toBe(
      'Alterar o cargo de Ana para Member? Você perderá o acesso de gestão de membros deste workspace.'
    )
  })
})
