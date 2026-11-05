import { FolderIcon, TrashIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'

export interface FolderCardProps extends React.ComponentProps<'div'> {
  error?: string
  folderId: string
  isDeleting?: boolean
  itemCount: number
  name: string
  onDelete?: (folderId: string) => Promise<void> | void
  subfolderCount: number
}
export function FolderCard({
  folderId,
  name,
  itemCount,
  subfolderCount,
  onDelete,
  error,
  isDeleting = false,
  className,
  ...props
}: FolderCardProps) {
  const [open, setOpen] = useState(false)
  const [internalError, setInternalError] = useState<string>()
  const handleDelete = useCallback(async () => {
    setInternalError(undefined)
    try {
      await onDelete?.(folderId)
      setOpen(false)
    } catch (cause) {
      setInternalError(errorMessage(cause))
    }
  }, [folderId, onDelete])
  const closeDialog = useCallback(() => setOpen(false), [])
  const handleDeleteClick = useCallback(() => {
    handleDelete().catch(() => undefined)
  }, [handleDelete])
  const displayedError = error ?? internalError
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-3 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50',
        className
      )}
      {...props}
    >
      <div className='flex items-center gap-2'>
        <FolderIcon aria-hidden='true' className='size-5 text-primary' />
        <span className='min-w-0 truncate font-bold font-mono text-sm'>
          {name}
        </span>
      </div>
      <div className='flex items-center justify-between gap-3 font-mono text-muted-foreground text-xs uppercase'>
        <span>
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span>
          {subfolderCount} {subfolderCount === 1 ? 'subpasta' : 'subpastas'}
        </span>
      </div>
      {onDelete ? (
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button size='sm' variant='destructive'>
              <TrashIcon aria-hidden='true' />
              Excluir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir pasta</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. “{name}” será excluída
                permanentemente.
              </DialogDescription>
            </DialogHeader>
            {displayedError ? (
              <ErrorState message={displayedError} variant='compact' />
            ) : null}
            <DialogFooter>
              <Button onClick={closeDialog} type='button' variant='outline'>
                Cancelar
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDeleteClick}
                variant='destructive'
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {displayedError && !open ? (
        <ErrorState message={displayedError} variant='compact' />
      ) : null}
    </div>
  )
}

export function FolderCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-2 border-border bg-muted p-4',
        className
      )}
    >
      <div className='h-4 w-2/3 animate-pulse bg-muted-foreground/20' />
      <div className='h-3 w-1/2 animate-pulse bg-muted-foreground/20' />
    </div>
  )
}
function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'Não foi possível concluir a operação.'
}
