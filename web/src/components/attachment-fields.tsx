import { Field, FieldLabel } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { Textarea } from '@/components/ui/textarea'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  DESCRIPTION_MAX,
} from '@/lib/item-validation'

const labelClass = 'font-normal text-[10px] text-muted-foreground'

export function AttachmentFields({
  description,
  disabled = false,
  error,
  file,
  id,
  onDescriptionChange,
  onFileChange,
}: {
  description: string
  disabled?: boolean
  error?: string
  file: File | undefined
  id: string
  onDescriptionChange: (value: string) => void
  onFileChange: (file: File | undefined) => void
}) {
  const invalid = Boolean(error)

  return (
    <>
      <Field aria-invalid={invalid || undefined}>
        <FieldLabel className={labelClass} htmlFor={`${id}-file`}>
          ARQUIVO
        </FieldLabel>
        <FileInput
          accept={ATTACHMENT_ACCEPT}
          aria-describedby={invalid ? `${id}-file-error` : undefined}
          disabled={disabled}
          hint={ATTACHMENT_HINT}
          id={`${id}-file`}
          isInvalid={invalid}
          name='file'
          onChange={onFileChange}
          value={file ?? null}
        />
        {error ? (
          <p
            className='text-destructive text-xs'
            id={`${id}-file-error`}
            role='alert'
          >
            {error}
          </p>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-description`}>
          DESCRIÇÃO (OPCIONAL)
        </FieldLabel>
        <Textarea
          className='h-24 resize-none rounded-none border-border bg-outline p-3 focus-visible:border-primary/50 focus-visible:ring-0'
          id={`${id}-description`}
          maxLength={DESCRIPTION_MAX}
          onValueChange={onDescriptionChange}
          value={description}
        />
      </Field>
    </>
  )
}
