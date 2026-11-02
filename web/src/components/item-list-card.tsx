import {
  DotsThreeVerticalIcon,
  FileIcon,
  ImageIcon,
  KeyIcon,
  LinkIcon,
} from '@phosphor-icons/react'
import { useCallback, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { getArchiveError, getRestoreError } from '@/api/item-errors'
import type { ItemResponse } from '@/api/types'
import { DeleteItemDialog } from '@/components/delete-item-dialog'
import { EditItemDialog } from '@/components/edit-item-dialog'
import {
  ShareAccessDialog,
  useCanManageSharing,
} from '@/components/share-access-dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { appToast } from '@/components/ui/toast'
import { useArchiveItem, useRestoreItem } from '@/hooks/use-item-mutations'

type OpenDialog = 'delete' | 'edit' | undefined
export type CopyKind = 'content' | 'title'

const typeIcons = {
  file: FileIcon,
  image: ImageIcon,
  link: LinkIcon,
  secret: KeyIcon,
  text: FileIcon,
} as const

export function ItemListCard({
  item,
  onCopy,
  workspaceId,
}: {
  item: ItemResponse
  onCopy: (text: string, kind: CopyKind) => void
  workspaceId: string
}) {
  const [dialog, setDialog] = useState<OpenDialog>()
  const [shareOpen, setShareOpen] = useState(false)
  const archive = useArchiveItem()
  const restore = useRestoreItem()
  const archived = Boolean(item.archivedAt)
  const canManageSharing = useCanManageSharing(workspaceId)
  const Icon = typeIcons[item.type]
  const preview = item.type === 'secret' ? '••••••••••••' : item.preview

  const closeDialog = useCallback(() => setDialog(undefined), [])
  const openEdit = useCallback(() => setDialog('edit'), [])
  const openDelete = useCallback(() => setDialog('delete'), [])
  const openSharing = useCallback(() => setShareOpen(true), [])
  const closeSharing = useCallback(() => setShareOpen(false), [])
  const handleCopyTitle = useCallback(
    () => onCopy(item.title, 'title'),
    [item.title, onCopy]
  )
  const canCopyContent = item.type === 'link' || item.type === 'text'
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

  return (
    <article className='flex min-h-21 cursor-default flex-col justify-between gap-3 border-2 border-border bg-card p-4 transition-all hover:border-primary/50'>
      <div className='flex w-full items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          {item.type === 'text' ? (
            <span
              aria-hidden='true'
              className='shrink-0 font-mono text-lg text-muted-foreground leading-none'
            >
              ¶
            </span>
          ) : (
            <Icon
              aria-hidden='true'
              className={`size-4 shrink-0 ${item.type === 'secret' ? 'text-amber-500' : 'text-muted-foreground'}`}
            />
          )}
          <h3 className='truncate font-bold font-mono text-sm tracking-wide'>
            {item.title}
          </h3>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {archived ? <Badge variant='outline'>Arquivado</Badge> : null}
          <span
            className={`px-1.5 py-0.5 font-mono font-semibold text-[10px] uppercase ${item.type === 'secret' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}
          >
            {item.type}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Ações de ${item.title}`}
                className='text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground'
                type='button'
              >
                <DotsThreeVerticalIcon aria-hidden='true' className='size-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {canManageSharing && !archived ? (
                <DropdownMenuItem onSelect={openSharing}>
                  Compartilhar
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={openEdit}>
                {archived ? 'Ver' : 'Editar'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopyTitle}>
                Copiar título
              </DropdownMenuItem>
              {canCopyContent ? (
                <DropdownMenuItem onSelect={handleCopyContent}>
                  Copiar conteúdo
                </DropdownMenuItem>
              ) : null}
              {archived ? (
                <>
                  <DropdownMenuItem onSelect={runRestore}>
                    Restaurar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={openDelete}>
                    Excluir definitivamente
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onSelect={runArchive}>
                  Arquivar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {preview ? (
        <p className='truncate font-mono text-muted-foreground text-xs'>
          {preview}
        </p>
      ) : null}
      {dialog === 'edit' ? (
        <EditItemDialog
          itemId={item.id}
          onClose={closeDialog}
          workspaceId={workspaceId}
        />
      ) : null}
      {dialog === 'delete' ? (
        <DeleteItemDialog
          item={item}
          onClose={closeDialog}
          workspaceId={workspaceId}
        />
      ) : null}
      {canManageSharing && !archived ? (
        <ShareAccessDialog
          onClose={closeSharing}
          open={shareOpen}
          target={{ id: item.id, kind: 'item', name: item.title }}
          workspaceId={workspaceId}
        />
      ) : null}
    </article>
  )
}
