import { File, Folder, Image, KeyRound, Link } from 'lucide-react'
import type { ItemResponse } from '@/api/types'
import { type CopyKind, ItemActions } from '@/components/items/item-actions'
import { ItemAttachmentDialog } from '@/components/items/item-attachment-dialog'
import { Badge } from '@/components/ui/badge'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'
import { canAccessItem } from '@/lib/item-permissions'

const typeIcons = {
  file: File,
  folder: Folder,
  image: Image,
  link: Link,
  secret: KeyRound,
  text: File,
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
  const permissions = useWorkspacePermissions(workspaceId)
  const canRead = canAccessItem(permissions, item.type, 'read')
  const archived = Boolean(item.archivedAt)
  const Icon = typeIcons[item.type]
  const preview = item.type === 'secret' ? '••••••••••••' : item.preview
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
          <ItemActions item={item} onCopy={onCopy} workspaceId={workspaceId} />
        </div>
      </div>
      {preview ? (
        <p className='truncate font-mono text-muted-foreground text-xs'>
          {preview}
        </p>
      ) : null}
      {canRead && (item.type === 'file' || item.type === 'image') ? (
        <ItemAttachmentDialog item={item} workspaceId={workspaceId} />
      ) : null}
    </article>
  )
}
