import type { CreateItemType, ItemResponse, ItemType } from '@/api/types'
import type { PermissionChecker } from '@/auth/permissions'

export function canAccessItem(
  checker: PermissionChecker,
  type: ItemType,
  action: 'read' | 'update' | 'delete'
) {
  return (
    checker.can('item', action) &&
    (type !== 'secret' ||
      (checker.can('secret', 'read') && checker.can('secret', action)))
  )
}

export function canCreateItem(
  checker: PermissionChecker,
  type: CreateItemType
) {
  return (
    checker.can('item', 'create') &&
    (type !== 'secret' || checker.can('secret', 'create'))
  )
}

export type ItemAction =
  | 'view'
  | 'edit'
  | 'copyTitle'
  | 'copyContent'
  | 'archive'
  | 'restore'
  | 'delete'
  | 'share'

export function getItemActions(
  item: Pick<ItemResponse, 'type' | 'archivedAt'>,
  checker: PermissionChecker
): ItemAction[] {
  const archived = Boolean(item.archivedAt)
  const canRead = canAccessItem(checker, item.type, 'read')
  const canUpdate = canAccessItem(checker, item.type, 'update')
  const canDelete = canAccessItem(checker, item.type, 'delete')
  const actions: { id: ItemAction; allowed: boolean }[] = [
    { allowed: !archived && checker.can('sharing', 'manage'), id: 'share' },
    { allowed: canRead && canUpdate && !archived, id: 'edit' },
    { allowed: canRead && (!canUpdate || archived), id: 'view' },
    { allowed: true, id: 'copyTitle' },
    {
      allowed: canRead && (item.type === 'text' || item.type === 'link'),
      id: 'copyContent',
    },
    { allowed: canUpdate && !archived, id: 'archive' },
    { allowed: canUpdate && archived, id: 'restore' },
    { allowed: canDelete && archived, id: 'delete' },
  ]
  return actions.filter(({ allowed }) => allowed).map(({ id }) => id)
}
