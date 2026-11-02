import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { getReplaceAttachmentError } from '@/api/item-errors'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { appToast } from '@/components/ui/toast'
import { useReplaceAttachment } from '@/hooks/use-item-mutations'
import {
  ATTACHMENT_ACCEPT,
  validateAttachmentFile,
} from '@/lib/item-validation'

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
  const abortRef = useRef<AbortController>(null)
  const replace = useReplaceAttachment()
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
    const controller = new AbortController()
    abortRef.current = controller
    setError(undefined)
    try {
      await replace.mutateAsync({
        file,
        itemId,
        signal: controller.signal,
        workspaceId,
      })
      setFile(null)
      setInputKey((key) => key + 1)
      appToast.success('Arquivo substituído.')
    } catch (cause) {
      setError(getReplaceAttachmentError(cause))
    } finally {
      abortRef.current = null
    }
  }, [file, itemId, replace, workspaceId])

  const handleReplaceClick = useCallback(() => {
    handleReplace().catch(() => undefined)
  }, [handleReplace])
  const handleCancel = useCallback(() => abortRef.current?.abort(), [])

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
      <div className='flex justify-end gap-2'>
        {replace.isPending ? (
          <Button onClick={handleCancel} size='sm' variant='outline'>
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
