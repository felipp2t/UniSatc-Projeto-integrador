import { cn } from 'cn'
import { CircleAlert, CircleCheck, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ATTACHMENT_HINT } from '@/lib/item-validation'

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024

interface FileInputProps {
  accept?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'false' | 'true'
  className?: string
  disabled?: boolean
  hint?: string
  id?: string
  isInvalid?: boolean
  name?: string
  onBlur?: () => void
  onChange?: (file: File) => void
  value?: File | null
}

function formatFileSize(bytes: number) {
  if (bytes < BYTES_PER_MB)
    return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`
  return `${(bytes / BYTES_PER_MB).toFixed(2)} MB`
}

export function FileInput({
  value,
  isInvalid = false,
  onChange,
  onBlur,
  accept,
  className,
  disabled = false,
  hint = ATTACHMENT_HINT,
  id,
  name,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
}: FileInputProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const file = value === undefined ? internalFile : value
  const selectFile = useCallback(
    (selectedFile: File | undefined) => {
      if (!selectedFile || disabled) return
      setInternalFile(selectedFile)
      onChange?.(selectedFile)
    },
    [disabled, onChange]
  )
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(false)
      selectFile(event.dataTransfer.files[0])
    },
    [selectFile]
  )
  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!disabled) setDragging(true)
    },
    [disabled]
  )
  const handleDragLeave = useCallback(() => setDragging(false), [])
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      selectFile(event.target.files?.[0]),
    [selectFile]
  )
  const StatusIcon = isInvalid ? CircleAlert : CircleCheck

  return (
    <div
      className={cn(
        'relative flex min-h-32 flex-col items-center justify-center gap-1.5 border border-border border-dashed bg-outline p-4 text-center transition-colors focus-within:border-primary hover:border-primary/60',
        dragging && 'border-primary bg-primary/5',
        isInvalid && 'border-destructive ring-2 ring-destructive/20',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        accept={accept}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid ?? (isInvalid || undefined)}
        className='absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed'
        disabled={disabled}
        id={id}
        name={name}
        onBlur={onBlur}
        onChange={handleInputChange}
        type='file'
      />
      {file ? (
        <>
          <StatusIcon
            aria-hidden='true'
            className={cn(
              'size-5',
              isInvalid ? 'text-destructive' : 'text-primary'
            )}
          />
          <span
            className={cn(
              'max-w-full break-all font-mono font-semibold text-sm',
              isInvalid ? 'text-destructive' : 'text-primary'
            )}
          >
            {file.name}
          </span>
          <span className='font-mono text-muted-foreground text-xs'>
            {formatFileSize(file.size)} · clique ou arraste para alterar
          </span>
        </>
      ) : (
        <>
          <Upload
            aria-hidden='true'
            className={cn(
              'size-5 text-muted-foreground',
              dragging && 'text-primary'
            )}
          />
          <span className='font-mono text-muted-foreground text-sm'>
            {dragging ? 'SOLTE PARA ANEXAR' : 'ARRASTE OU CLIQUE PARA ENVIAR'}
          </span>
          <span className='font-mono text-muted-foreground text-xs'>
            {hint}
          </span>
        </>
      )}
    </div>
  )
}

export type { FileInputProps }
