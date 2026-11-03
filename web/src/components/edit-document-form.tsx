import { useCallback, useId, useState } from 'react'
import { getUpdateItemError } from '@/api/item-errors'
import {
  EditFormShell,
  type FormProps,
  labelClass,
} from '@/components/edit-item-form-shell'
import { ReplaceAttachmentField } from '@/components/replace-attachment-field'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useEditForm } from '@/hooks/use-edit-form'
import { useUpdateAttachmentMetadata } from '@/hooks/use-item-mutations'
import { DESCRIPTION_MAX, isDescriptionInvalid } from '@/lib/item-validation'

export function EditDocumentForm({
  item,
  readOnly = false,
  onBusyChange,
  onClose,
  workspaceId,
}: FormProps) {
  const id = useId()
  const archived = Boolean(item.archivedAt)
  const update = useUpdateAttachmentMetadata()
  const [description, setDescription] = useState(item.description ?? '')
  const [replacing, setReplacing] = useState(false)
  const form = useEditForm({
    archived,
    extraBusy: replacing,
    getError: getUpdateItemError,
    initialTitle: item.title,
    onBusyChange,
    onClose,
    pending: update.isPending,
    readOnly,
    save: (title) =>
      update.mutateAsync({
        itemId: item.id,
        request: { description: description.trim() || undefined, title },
        workspaceId,
      }),
    validate: () => ({ description: isDescriptionInvalid(description) }),
  })
  const { clearInvalid } = form
  const handleDescription = useCallback(
    (value: string) => {
      setDescription(value)
      clearInvalid('description')
    },
    [clearInvalid]
  )
  const descriptionInvalid = Boolean(form.invalid.description)

  return (
    <div className='space-y-6'>
      <EditFormShell
        archived={archived}
        form={form}
        onClose={onClose}
        readOnly={readOnly}
        type={item.type}
      >
        <Field aria-invalid={descriptionInvalid || undefined}>
          <FieldLabel className={labelClass} htmlFor={`${id}-description`}>
            DESCRIÇÃO
          </FieldLabel>
          <Textarea
            aria-describedby={
              descriptionInvalid ? `${id}-description-error` : undefined
            }
            aria-invalid={descriptionInvalid || undefined}
            className='h-24 resize-none rounded-none border-border bg-outline p-3 focus-visible:border-primary/50 focus-visible:ring-0'
            id={`${id}-description`}
            maxLength={DESCRIPTION_MAX}
            name='description'
            onValueChange={handleDescription}
            readOnly={readOnly}
            value={description}
          />
          {descriptionInvalid ? (
            <p
              className='text-destructive text-xs'
              id={`${id}-description-error`}
              role='alert'
            >
              A descrição pode ter no máximo {DESCRIPTION_MAX} caracteres.
            </p>
          ) : null}
        </Field>
      </EditFormShell>
      {archived || readOnly ? null : (
        <ReplaceAttachmentField
          disabled={update.isPending}
          itemId={item.id}
          onPendingChange={setReplacing}
          workspaceId={workspaceId}
        />
      )}
    </div>
  )
}
