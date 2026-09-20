import { CheckCircleIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import { useCallback, useState } from 'react'

interface FileInputProps {
  accept?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'false' | 'true'
  className?: string
  disabled?: boolean
  id?: string
  isInvalid?: boolean
  onBlur?: () => void
  onChange?: (file: File) => void
  value?: File | null
}

export function FileInput({
  value,
  isInvalid = false,
  onChange,
  onBlur,
  accept,
  className,
  disabled = false,
  id,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
}: FileInputProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null)
  const file = value ?? internalFile
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
      selectFile(event.dataTransfer.files[0])
    },
    [selectFile]
  )
  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
    },
    []
  )
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      selectFile(event.target.files?.[0]),
    [selectFile]
  )
  return (
    <div
      className={cn(
        'relative flex min-h-40 flex-col items-center justify-center gap-2 border border-border border-dashed bg-outline p-4 text-center transition-colors hover:border-primary/60',
        isInvalid && 'border-destructive ring-2 ring-destructive/20',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        accept={accept}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid ?? isInvalid}
        className='absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed'
        disabled={disabled}
        id={id}
        onBlur={onBlur}
        onChange={handleInputChange}
        type='file'
      />
      {file ? (
        <>
          <CheckCircleIcon aria-hidden='true' className='size-5 text-primary' />
          <span className='font-mono font-semibold text-primary text-sm'>
            {file.name}
          </span>
          <span className='font-mono text-muted-foreground text-xs'>
            {(file.size / 1024 / 1024).toFixed(2)} MB · clique para alterar
          </span>
        </>
      ) : (
        <>
          <UploadSimpleIcon
            aria-hidden='true'
            className='size-5 text-muted-foreground'
          />
          <span className='font-mono text-muted-foreground text-sm'>
            ARRASTE OU CLIQUE PARA ENVIAR
          </span>
          <span className='font-mono text-muted-foreground text-xs'>
            PDF, DOCX, TXT ou MD até 10MB
          </span>
        </>
      )}
    </div>
  )
}

export type { FileInputProps }
