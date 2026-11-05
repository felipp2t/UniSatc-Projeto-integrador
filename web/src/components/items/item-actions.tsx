import { EllipsisVertical } from 'lucide-react'
import { useCallback, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { getArchiveError, getRestoreError } from '@/api/item-errors'
import type { ItemResponse } from '@/api/types'
import { DeleteItemDialog } from '@/components/items/delete-item-dialog'
import { EditItemDialog } from '@/components/items/edit-item-dialog'
import { ShareAccessDialog } from '@/components/workspace/share-access-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { appToast } from '@/components/ui/toast'
import { useArchiveItem, useRestoreItem } from '@/hooks/use-item-mutations'
import { usePublicationManagementAccess } from '@/hooks/use-publication-management-access'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'
import { getItemActions, type ItemAction } from '@/lib/item-permissions'

export type CopyKind = 'content' | 'title'

const labels: Record<ItemAction, string> = {
  archive: 'Arquivar',
  copyContent: 'Copiar conteúdo',
  copyTitle: 'Copiar título',
  delete: 'Excluir definitivamente',
  edit: 'Editar',
  restore: 'Restaurar',
  share: 'Compartilhar',
  view: 'Ver',
}

export function ItemActions({
  item,
  workspaceId,
  onCopy,
}: {
  item: ItemResponse
  workspaceId: string
  onCopy: (text: string, kind: CopyKind) => void
}) {
  const permissions = useWorkspacePermissions(workspaceId)
  const canManageSharing = usePublicationManagementAccess(
    workspaceId,
    item.collectionId ?? undefined
  )
  const actions = getItemActions(item, permissions, canManageSharing)
  const [dialog, setDialog] = useState<'view' | 'edit' | 'delete' | 'share'>()
  const closeDialog = useCallback(() => setDialog(undefined), [])
  const archive = useArchiveItem()
  const restore = useRestoreItem()
  const handleCopyTitle = useCallback(
    () => onCopy(item.title, 'title'),
    [item.title, onCopy]
  )
  const handleCopyContent = useCallback(async () => {
    try {
      const { data } = await itemsApi.get(workspaceId, item.id)
      const content = data.type === 'link' ? data.linkUrl : data.textContent
      if (!content) throw new Error('Item sem conteúdo para copiar')
      onCopy(content, 'content')
    } catch {
      appToast.error('Não foi possível copiar o conteúdo.')
    }
  }, [item.id, onCopy, workspaceId])
  const isBusy = archive.isPending || restore.isPending
  const runArchive = useCallback(() => {
    if (isBusy) return
    archive
      .mutateAsync({ itemId: item.id, workspaceId })
      .then(() => appToast.success('Item arquivado.'))
      .catch((error: unknown) => appToast.error(getArchiveError(error)))
  }, [archive, isBusy, item.id, workspaceId])
  const runRestore = useCallback(() => {
    if (isBusy) return
    restore
      .mutateAsync({ itemId: item.id, workspaceId })
      .then(() => appToast.success('Item restaurado.'))
      .catch((error: unknown) => appToast.error(getRestoreError(error)))
  }, [isBusy, item.id, restore, workspaceId])

  const handlers: Record<ItemAction, () => void> = {
    archive: runArchive,
    copyContent: handleCopyContent,
    copyTitle: handleCopyTitle,
    delete: () => setDialog('delete'),
    edit: () => setDialog('edit'),
    restore: runRestore,
    share: () => setDialog('share'),
    view: () => setDialog('view'),
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Ações de ${item.title}`}
            className='text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground'
            type='button'
          >
            <EllipsisVertical aria-hidden='true' className='size-4' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {actions.map((action) => (
            <DropdownMenuItem key={action} onSelect={handlers[action]}>
              {labels[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {(dialog === 'view' && actions.includes('view')) ||
      (dialog === 'edit' && actions.includes('edit')) ? (
        <EditItemDialog
          itemId={item.id}
          onClose={closeDialog}
          readOnly={dialog !== 'edit'}
          workspaceId={workspaceId}
        />
      ) : null}
      {dialog === 'delete' && actions.includes('delete') ? (
        <DeleteItemDialog
          item={item}
          onClose={closeDialog}
          workspaceId={workspaceId}
        />
      ) : null}
      {dialog === 'share' && actions.includes('share') ? (
        <ShareAccessDialog
          onClose={closeDialog}
          open
          target={{
            collectionId: item.collectionId ?? '',
            id: item.id,
            kind: 'item',
            name: item.title,
          }}
          workspaceId={workspaceId}
        />
      ) : null}
    </>
  )
}
