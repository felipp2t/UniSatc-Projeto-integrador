import { describe, expect, it } from 'vitest'
import { workspacePermissionsSchema } from './permissions'

const response = {
  isOwner: false,
  permissions: [{ action: 'read', resource: 'item' }],
  roleId: 'role-1',
  roleName: 'Member',
}

describe('workspace permission contract', () => {
  it('accepts the fixed catalog including all, groups, sharing and secrets', () => {
    expect(
      workspacePermissionsSchema.parse({
        ...response,
        permissions: [
          { action: 'all', resource: 'item' },
          { action: 'read', resource: 'secret' },
          { action: 'manage', resource: 'group' },
          { action: 'manage', resource: 'sharing' },
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

  it('rejects a malformed response instead of producing partial permissions', () => {
    expect(
      workspacePermissionsSchema.safeParse({ permissions: [] }).success
    ).toBe(false)
  })
})
