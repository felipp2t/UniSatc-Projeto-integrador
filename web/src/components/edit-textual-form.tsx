import { useQuery } from '@tanstack/react-query'
import { useCallback, useId, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { getUpdateItemError } from '@/api/item-errors'
import { itemKeys } from '@/api/item-keys'
import type { UpdateItemRequest } from '@/api/types'
import {
  EditFormShell,
  type FormProps,
} from '@/components/edit-item-form-shell'
import { ItemContentField } from '@/components/item-content-control'
import { LoadingState } from '@/components/ui/loading-state'
import { useEditForm } from '@/hooks/use-edit-form'
import { useUpdateItem } from '@/hooks/use-item-mutations'
import { isContentInvalid, type TextualItemType } from '@/lib/item-validation'

function buildUpdateRequest(
  type: TextualItemType,
  title: string,
  content: string
): UpdateItemRequest {
  if (type === 'text') return { textContent: content, title }
  if (type === 'link') return { linkUrl: content.trim(), title }
  return { title, value: content }
}

export function EditTextualForm({
  item,
  onBusyChange,
  onClose,
  type,
  workspaceId,
}: FormProps & { type: TextualItemType }) {
  const archived = Boolean(item.archivedAt)
  const secret = useQuery({
    // O valor lido some do cache da query ao fechar o diálogo (gcTime 0); o
    // enviado na edição some do MutationCache pelo gcTime 0 das mutations. A
    // chave fica fora de itemKeys.all para não ser relida a cada salvamento.
    enabled: type === 'secret' && !archived,
    gcTime: 0,
    queryFn: async () =>
      (await itemsApi.revealSecret(workspaceId, item.id)).data,
    queryKey: itemKeys.secret(workspaceId, item.id),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (type === 'secret' && !archived) {
    if (secret.isPending) return <LoadingState label='Carregando segredo…' />
    if (secret.isError) {
      return (
        <p className='text-destructive text-sm' role='alert'>
          Não é possível editar este segredo: você não tem permissão ou o item
          está indisponível.
        </p>
      )
    }
  }

  let initialContent = item.linkUrl ?? ''
  if (type === 'text') initialContent = item.textContent ?? ''
  if (type === 'secret') initialContent = secret.data?.value ?? ''

  return (
    <TextualFields
      archived={archived}
      initialContent={initialContent}
      item={item}
      onBusyChange={onBusyChange}
      onClose={onClose}
      type={type}
      workspaceId={workspaceId}
    />
  )
}

function TextualFields({
  archived,
  initialContent,
  item,
  onBusyChange,
  onClose,
  type,
  workspaceId,
}: FormProps & {
  archived: boolean
  initialContent: string
  type: TextualItemType
}) {
  const id = useId()
  const update = useUpdateItem()
  const [content, setContent] = useState(initialContent)
  const form = useEditForm({
    archived,
    getError: (cause) => getUpdateItemError(cause, type === 'secret'),
    initialTitle: item.title,
    onBusyChange,
    onClose,
    pending: update.isPending,
    save: (title) =>
      update.mutateAsync({
        itemId: item.id,
        request: buildUpdateRequest(type, title, content),
        workspaceId,
      }),
    validate: () => ({ content: isContentInvalid(type, content) }),
  })
  const { clearInvalid } = form
  const handleContent = useCallback(
    (value: string) => {
      setContent(value)
      clearInvalid('content')
    },
    [clearInvalid]
  )

  return (
    <EditFormShell
      archived={archived}
      form={form}
      onClose={onClose}
      type={type}
    >
      {archived && type === 'secret' ? (
        <p className='text-muted-foreground text-sm'>
          O valor fica oculto enquanto o item está arquivado.
        </p>
      ) : (
        <ItemContentField
          id={`${id}-content`}
          invalid={Boolean(form.invalid.content)}
          onChange={handleContent}
          type={type}
          value={content}
        />
      )}
    </EditFormShell>
  )
}
