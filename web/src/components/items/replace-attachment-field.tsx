import { useCallback, useEffect, useId, useState } from 'react'
import { getReplaceAttachmentError } from '@/api/item-errors'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { appToast } from '@/components/ui/toast'
import { useAttachmentUpload } from '@/hooks/use-attachment-upload'
import { useReplaceAttachment } from '@/hooks/use-item-mutations'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  validateAttachmentFile,
} from '@/lib/item-validation'
import { UploadProgress } from '@/components/items/upload-progress'

export function ReplaceAttachmentField({
  disabled,
  itemId,
  onPendingChange,
  workspaceId,
}: {
  disabled: boolean
  itemId: string
  onPendingChange: (pending: boolean) => void
  workspaceId: string
}) {
  const id = useId()
  const replace = useReplaceAttachment()
  const { cancel, progress, upload } = useAttachmentUpload()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>()
  const [inputKey, setInputKey] = useState(0)

  useEffect(
    () => onPendingChange(replace.isPending),
    [onPendingChange, replace.isPending]
  )

  const handleFileChange = useCallback((selected: File) => {
    const validationError = validateAttachmentFile(selected)
    setError(validationError)
    setFile(validationError ? null : selected)
    // Remonta o input para não exibir um arquivo recusado.
    if (validationError) setInputKey((key) => key + 1)
  }, [])

  const handleReplace = useCallback(async () => {
    if (!file) return
    setError(undefined)
    try {
      await upload((options) =>
        replace.mutateAsync({ file, itemId, options, workspaceId })
      )
      setFile(null)
      setInputKey((key) => key + 1)
      appToast.success('Arquivo substituído.')
    } catch (cause) {
      setError(getReplaceAttachmentError(cause))
    }
  }, [file, itemId, replace, upload, workspaceId])

  const handleReplaceClick = useCallback(() => {
    handleReplace().catch(() => undefined)
  }, [handleReplace])

  return (
    <Field aria-invalid={Boolean(error) || undefined}>
      <FieldLabel
        className='font-normal text-[10px] text-muted-foreground'
        htmlFor={id}
      >
        SUBSTITUIR ARQUIVO
      </FieldLabel>
      <FileInput
        accept={ATTACHMENT_ACCEPT}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled || replace.isPending}
        hint={ATTACHMENT_HINT}
        id={id}
        isInvalid={Boolean(error)}
        key={inputKey}
        onChange={handleFileChange}
        value={file}
      />
      {error ? (
        <p className='text-destructive text-xs' id={`${id}-error`} role='alert'>
          {error}
        </p>
      ) : null}
      {progress === undefined ? null : (
        <UploadProgress label={`${progress}%`} progress={progress} />
      )}
      <div className='flex justify-end gap-2'>
        {replace.isPending ? (
          <Button onClick={cancel} size='sm' variant='outline'>
            Cancelar envio
          </Button>
        ) : null}
        <Button
          disabled={disabled || !file}
          loading={replace.isPending}
          onClick={handleReplaceClick}
          size='sm'
          variant='outline'
        >
          Substituir arquivo
        </Button>
      </div>
    </Field>
  )
}
