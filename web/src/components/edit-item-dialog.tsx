import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { getLoadItemError } from '@/api/item-errors'
import { itemKeys } from '@/api/item-keys'
import type { ItemResponse } from '@/api/types'
import { EditDocumentForm } from '@/components/edit-document-form'
import type { FormProps } from '@/components/edit-item-form-shell'
import { EditTextualForm } from '@/components/edit-textual-form'
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
  readOnly = false,
  onClose,
  workspaceId,
}: {
  itemId: string
  readOnly?: boolean
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
        {getLoadItemError(item.error)}
      </p>
    )
  } else if (item.data) {
    body = (
      <EditItemForm
        item={item.data}
        onBusyChange={setBusy}
        onClose={onClose}
        readOnly={readOnly}
        workspaceId={workspaceId}
      />
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
