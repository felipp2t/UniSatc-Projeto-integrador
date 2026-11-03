import { describe, expect, it } from 'vitest'
import { createPermissionChecker } from '@/auth/permissions'
import {
  canAccessItem,
  canCreateItem,
  getItemActions,
} from './item-permissions'

describe('item permission policy', () => {
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

  it('uses the same creation policy for ordinary items and secrets', () => {
    const checker = createPermissionChecker([
      { action: 'create', resource: 'item' },
    ])
    expect(canCreateItem(checker, 'text')).toBe(true)
    expect(canCreateItem(checker, 'secret')).toBe(false)
    expect(canCreateItem(createPermissionChecker([], true), 'secret')).toBe(
      true
    )
  })

  it('derives the read-only menu from the item and effective permissions', () => {
    const checker = createPermissionChecker([
      { action: 'read', resource: 'item' },
    ])
    expect(getItemActions({ archivedAt: null, type: 'text' }, checker)).toEqual(
      ['view', 'copyTitle', 'copyContent']
    )
    expect(
      getItemActions({ archivedAt: null, type: 'secret' }, checker)
    ).toEqual(['copyTitle'])
  })
})
