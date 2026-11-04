import { TrashIcon } from '@phosphor-icons/react'
import { useCallback } from 'react'
import type { AccessGroupResponse } from '@/api/types'
import { AccessGroupNameForm } from '@/components/access-group-name-form'
import { Button } from '@/components/ui/button'

export function AccessGroupListItem({
  editing,
  group,
  onDelete,
  onEdit,
  onSelect,
  selected,
  workspaceId,
}: {
  editing: boolean
  group: AccessGroupResponse
  onDelete: (group: AccessGroupResponse) => void
  onEdit: (group: AccessGroupResponse | undefined) => void
  onSelect: (group: AccessGroupResponse) => void
  selected: boolean
  workspaceId: string
}) {
  const select = useCallback(() => onSelect(group), [group, onSelect])
  const edit = useCallback(() => onEdit(group), [group, onEdit])
  const cancel = useCallback(() => onEdit(undefined), [onEdit])
  const remove = useCallback(() => onDelete(group), [group, onDelete])
  const saved = useCallback(() => onEdit(undefined), [onEdit])

  return (
    <li className='p-3'>
      {editing ? (
        <AccessGroupNameForm
          group={group}
          onCancel={cancel}
          onSaved={saved}
          workspaceId={workspaceId}
        />
      ) : (
        <div className='flex items-center gap-2'>
          <button
            aria-current={selected ? 'true' : undefined}
            className='min-h-10 min-w-0 flex-1 rounded-sm px-2 text-left font-medium text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            onClick={select}
            type='button'
          >
            <span className='block break-words'>{group.name}</span>
          </button>
          <Button
            aria-label={`Renomear ${group.name}`}
            onClick={edit}
            size='sm'
            variant='outline'
          >
            Renomear
          </Button>
          <Button
            aria-label={`Excluir ${group.name}`}
            onClick={remove}
            size='icon'
            variant='ghost'
          >
            <TrashIcon aria-hidden='true' size={15} />
          </Button>
        </div>
      )}
    </li>
  )
}
