import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { receivedContentApi } from '@/api/endpoints'
import { receivedContentKeys } from '@/api/workspace-keys'
import { ItemAttachmentDialog } from '@/components/item-attachment-dialog'
import { MarkdownContent } from '@/components/markdown-content'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { LoadingState } from '@/components/ui/loading-state'
import { SecretInput } from '@/components/ui/secret-input'

export function ReceivedItemDialog({
  itemId,
  onClose,
  workspaceId,
}: {
  itemId: string
  onClose: () => void
  workspaceId: string
}) {
  const item = useQuery({
    gcTime: 0,
    queryFn: async () =>
      (await receivedContentApi.read(workspaceId, itemId)).data,
    queryKey: receivedContentKeys.detail(workspaceId, itemId),
  })
  const secret = useQuery({
    enabled: item.data?.type === 'secret',
    gcTime: 0,
    queryFn: async () =>
      (await receivedContentApi.secret(workspaceId, itemId)).data.value,
    queryKey: receivedContentKeys.secret(workspaceId, itemId),
    refetchOnWindowFocus: false,
    retry: false,
  })
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{item.data?.title ?? 'Conteúdo recebido'}</DialogTitle>
          <DialogDescription>
            Compartilhamento recebido · somente leitura
          </DialogDescription>
        </DialogHeader>
        {item.isPending ? (
          <LoadingState label='Carregando conteúdo recebido…' />
        ) : null}
        {item.isError ? (
          <p className='text-destructive text-sm' role='alert'>
            Este conteúdo não está mais disponível.
          </p>
        ) : null}
        {!item.isError && item.data?.type === 'text' ? (
          <MarkdownContent content={item.data.textContent ?? ''} />
        ) : null}
        {!item.isError && item.data?.type === 'link' && item.data.linkUrl ? (
          <a
            className='break-all text-primary underline'
            href={item.data.linkUrl}
            rel='noopener noreferrer'
            target='_blank'
          >
            {item.data.linkUrl}
          </a>
        ) : null}
        {!item.isError && item.data?.type === 'secret' ? (
          secret.isPending ? (
            <LoadingState label='Carregando segredo…' />
          ) : secret.isError ? (
            <p className='text-destructive text-sm' role='alert'>
              Não foi possível carregar o segredo recebido.
            </p>
          ) : (
            <Field>
              <FieldLabel htmlFor={`received-secret-${itemId}`}>
                Valor do segredo
              </FieldLabel>
              <SecretInput
                autoComplete='off'
                id={`received-secret-${itemId}`}
                readOnly
                value={secret.data ?? ''}
              />
            </Field>
          )
        ) : null}
        {!item.isError &&
        item.data &&
        (item.data.type === 'file' || item.data.type === 'image') ? (
          <ItemAttachmentDialog
            item={item.data}
            received
            workspaceId={workspaceId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
