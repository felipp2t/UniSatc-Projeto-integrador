import { useCallback, useId, useState } from 'react'
import { getDeleteItemError } from '@/api/item-errors'
import type { ItemResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { appToast } from '@/components/ui/toast'
import { useDeleteItem } from '@/hooks/use-item-mutations'

export function DeleteItemDialog({
  item,
  onClose,
  workspaceId,
}: {
  item: ItemResponse
  onClose: () => void
  workspaceId: string
}) {
  const confirmId = useId()
  const remove = useDeleteItem()
  const [typedTitle, setTypedTitle] = useState('')
  const [error, setError] = useState<string>()
  const { isPending } = remove
  const canDelete =
    Boolean(item.archivedAt) && typedTitle.trim() === item.title.trim()

  const close = useCallback(() => {
    if (!isPending) onClose()
  }, [isPending, onClose])
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close()
    },
    [close]
  )
  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setTypedTitle(event.target.value),
    []
  )
  const confirm = useCallback(async () => {
    if (!canDelete) return
    setError(undefined)
    try {
      await remove.mutateAsync({ itemId: item.id, workspaceId })
      appToast.success('Item excluído definitivamente.')
      onClose()
    } catch (cause) {
      setError(getDeleteItemError(cause))
    }
  }, [canDelete, item.id, onClose, remove, workspaceId])
  const handleConfirm = useCallback(() => {
    confirm().catch(() => undefined)
  }, [confirm])

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir definitivamente</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. O item e seu anexo serão excluídos
            definitivamente e não poderão ser recuperados.
          </DialogDescription>
        </DialogHeader>
        <p className='break-words font-bold font-mono text-sm'>{item.title}</p>
        <Field>
          <FieldLabel htmlFor={confirmId}>
            Digite o título do item para confirmar
          </FieldLabel>
          <Input
            autoComplete='off'
            disabled={isPending}
            id={confirmId}
            onChange={handleTitleChange}
            value={typedTitle}
          />
        </Field>
        {error ? (
          <p className='text-destructive text-xs' role='alert'>
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={isPending} onClick={close} variant='outline'>
            Cancelar
          </Button>
          <Button
            disabled={!canDelete}
            loading={isPending}
            onClick={handleConfirm}
            variant='destructive'
          >
            {isPending ? 'Excluindo…' : 'Excluir definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
