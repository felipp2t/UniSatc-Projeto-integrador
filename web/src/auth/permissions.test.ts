import { describe, expect, it, vi } from 'vitest'
import {
  canAccessItem,
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

  it('allows owners to access secrets even when effective permissions omit secret grants', () => {
    expect(createPermissionChecker([], true).can('secret', 'read')).toBe(true)
  })

  it('requires both item and secret grants to change a secret', () => {
    const itemOnly = createPermissionChecker([
      { action: 'all', resource: 'item' },
    ])
    expect(canAccessItem(itemOnly, 'text', 'update')).toBe(true)
    expect(canAccessItem(itemOnly, 'secret', 'update')).toBe(false)
    const secretEditor = createPermissionChecker([
      { action: 'update', resource: 'item' },
      { action: 'read', resource: 'secret' },
      { action: 'update', resource: 'secret' },
    ])
    expect(canAccessItem(secretEditor, 'secret', 'update')).toBe(true)
    expect(canAccessItem(secretEditor, 'secret', 'delete')).toBe(false)
  })

  it('enforces every annotated route, including parent routes', () => {
    expect(() =>
      enforceRoutePermission(
        [
          {
            routeId: '/_protected',
            staticData: {
              permission: { action: 'read', resource: 'workspace' },
            },
          },
          {
            routeId: '/_protected/atividades',
            staticData: {
              permission: { action: 'read', resource: 'activity' },
            },
          },
        ],
        createPermissionChecker([{ action: 'read', resource: 'activity' }])
      )
    ).toThrow()
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
