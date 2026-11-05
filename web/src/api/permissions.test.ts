import { describe, expect, it } from 'vitest'
import { workspacePermissionsSchema } from './permissions'

const response = {
  globalRole: null,
  isOwner: false,
  isTeamLeader: false,
  permissions: [{ action: 'read', resource: 'item' }],
  roleName: 'Member',
  teamId: null,
}

describe('workspace permission contract', () => {
  it('accepts fixed roles and team scoped permissions', () => {
    expect(
      workspacePermissionsSchema.parse({
        ...response,
        permissions: [
          { action: 'all', resource: 'item' },
          { action: 'read', resource: 'secret' },
          { action: 'manage', resource: 'team' },
          { action: 'manage', resource: 'collection' },
        ],
      }).permissions
    ).toHaveLength(4)
  })

  it.each([
    { action: 'read', resource: 'itme' },
    { action: 'udpate', resource: 'item' },
  ])('rejects unknown permission identifiers: %j', (permission) => {
    expect(
      workspacePermissionsSchema.safeParse({
        ...response,
        permissions: [permission],
      }).success
    ).toBe(false)
  })

  it('accepts owner, admin and maintainer global role shapes', () => {
    expect(
      workspacePermissionsSchema.parse({
        ...response,
        globalRole: 'ADMIN',
        isOwner: true,
        roleName: 'Owner',
      }).globalRole
    ).toBe('ADMIN')
    expect(
      workspacePermissionsSchema.parse({
        ...response,
        globalRole: 'MAINTAINER',
        roleName: 'Maintainer',
      }).globalRole
    ).toBe('MAINTAINER')
  })

  it('rejects removed group and sharing permission resources', () => {
    for (const resource of ['group', 'sharing']) {
      expect(
        workspacePermissionsSchema.safeParse({
          ...response,
          permissions: [{ action: 'manage', resource }],
        }).success
      ).toBe(false)
    }
  })

  it('rejects a malformed response instead of producing partial permissions', () => {
    expect(
      workspacePermissionsSchema.safeParse({ permissions: [] }).success
    ).toBe(false)
  })
})
