import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { isForbiddenOrNotFound } from '@/api/http-status'
import { getLoadItemError } from '@/api/item-errors'
import { itemKeys } from '@/api/item-keys'
import type { ItemResponse } from '@/api/types'
import { EditDocumentForm } from '@/components/items/edit-document-form'
import type { FormProps } from '@/components/items/edit-item-form-shell'
import { EditTextualForm } from '@/components/items/edit-textual-form'
import { ItemAttachmentDialog } from '@/components/items/item-attachment-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingState } from '@/components/ui/loading-state'
import type { TextualItemType } from '@/lib/item-validation'

function isTextual(type: ItemResponse['type']): type is TextualItemType {
  return type === 'text' || type === 'link' || type === 'secret'
}

export function EditItemDialog({
  itemId,
  readOnly,
  unavailableOnAccessError = false,
  showAttachmentPreview = false,
  onClose,
  workspaceId,
}: {
  itemId: string
  readOnly: boolean
  unavailableOnAccessError?: boolean
  showAttachmentPreview?: boolean
  onClose: () => void
  workspaceId: string
}) {
  const item = useQuery({
    // Sem cache entre aberturas: o formulário parte sempre do estado atual.
    gcTime: 0,
    queryFn: async () => (await itemsApi.get(workspaceId, itemId)).data,
    queryKey: itemKeys.detail(workspaceId, itemId),
    refetchOnWindowFocus: false,
  })
  const archived = Boolean(item.data?.archivedAt)
  const [busy, setBusy] = useState(false)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(open || busy)) onClose()
    },
    [busy, onClose]
  )

  let body = <LoadingState label='Carregando item…' />
  if (item.isError) {
    body = (
      <p className='text-destructive text-sm' role='alert'>
        {unavailableOnAccessError && isForbiddenOrNotFound(item.error)
          ? 'Item indisponível'
          : getLoadItemError(item.error)}
      </p>
    )
  } else if (item.data) {
    body = (
      <>
        <EditItemForm
          item={item.data}
          onBusyChange={setBusy}
          onClose={onClose}
          readOnly={readOnly}
          workspaceId={workspaceId}
        />
        {showAttachmentPreview &&
        readOnly &&
        (item.data.type === 'file' || item.data.type === 'image') ? (
          <div className='mt-4'>
            <ItemAttachmentDialog item={item.data} workspaceId={workspaceId} />
          </div>
        ) : null}
      </>
    )
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className='max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto rounded-none border-border bg-black p-6 text-white shadow-none sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='font-bold font-mono text-xs uppercase'>
            {archived
              ? 'Item arquivado'
              : readOnly
                ? 'Ver item'
                : 'Editar item'}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            {archived
              ? 'Consulte os dados do item arquivado.'
              : readOnly
                ? 'Consulte os dados do item.'
                : 'Altere o título e o conteúdo do item.'}
          </DialogDescription>
        </DialogHeader>
        <div className='mt-6'>{body}</div>
      </DialogContent>
    </Dialog>
  )
}

function EditItemForm(props: FormProps) {
  const { type } = props.item
  if (isTextual(type)) return <EditTextualForm {...props} type={type} />
  return <EditDocumentForm {...props} />
}
