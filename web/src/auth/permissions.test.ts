import { describe, expect, it, vi } from 'vitest'
import {
  createPermissionChecker,
  denyAllPermissions,
  enforceRoutePermission,
  type PermissionChecker,
} from './permissions'

describe('permission guards', () => {
  it('checks effective resource permissions', () => {
    const checker = createPermissionChecker([
      { action: 'read', resource: 'item' },
      { action: 'create', resource: 'collection' },
    ])

    expect(checker.can('item', 'read')).toBe(true)
    expect(checker.can('item', 'create')).toBe(false)
    expect(checker.can('collection', 'create')).toBe(true)
  })

  it('expands all actions for a resource', () => {
    const checker = createPermissionChecker([
      { action: 'all', resource: 'collection' },
    ])

    expect(checker.can('collection', 'read')).toBe(true)
    expect(checker.can('collection', 'delete')).toBe(true)
    expect(checker.can('item', 'delete')).toBe(false)
  })

  it('denies permissions by default', () => {
    expect(denyAllPermissions.can('workspace', 'read')).toBe(false)
  })

  it('allows a route when its checker grants the required permission', () => {
    const checker: PermissionChecker = {
      can: vi.fn().mockReturnValue(true),
    }

    expect(() =>
      enforceRoutePermission(
        [
          {
            routeId: '/_protected/components',
            staticData: {
              permission: { action: 'read', resource: 'workspace' },
            },
          },
        ],
        checker
      )
    ).not.toThrow()
    expect(checker.can).toHaveBeenCalledWith('workspace', 'read')
  })

  it('throws a not-found error when a route lacks permission', () => {
    const checker: PermissionChecker = {
      can: vi.fn().mockReturnValue(false),
    }

    expect(() =>
      enforceRoutePermission(
        [
          {
            routeId: '/_protected/components',
            staticData: {
              permission: { action: 'read', resource: 'workspace' },
            },
          },
        ],
        checker
      )
    ).toThrow()
  })

  it('does nothing for routes without a permission requirement', () => {
    const checker: PermissionChecker = {
      can: vi.fn(),
    }

    enforceRoutePermission(
      [{ routeId: '/_protected/components', staticData: {} }],
      checker
    )

    expect(checker.can).not.toHaveBeenCalled()
  })
})
