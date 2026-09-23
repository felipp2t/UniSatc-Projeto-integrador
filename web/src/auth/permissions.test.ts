import { describe, expect, it, vi } from 'vitest'
import {
  denyAllPermissions,
  enforceRoutePermission,
  type PermissionChecker,
} from './permissions'

describe('permission guards', () => {
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
