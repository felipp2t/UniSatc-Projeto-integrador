import { CheckmarkCircle02Icon, Upload01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from 'cn'
import { useCallback, useRef, useState } from 'react'

interface FileInputProps {
  accept?: string
  className?: string
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
  id,
}: FileInputProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const file = value ?? internalFile

  const selectFile = useCallback(
    (selectedFile: File | undefined) => {
      if (!selectedFile) return
      setInternalFile(selectedFile)
      onChange?.(selectedFile)
    },
    [onChange]
  )
  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => event.preventDefault(),
    []
  )
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault()
      selectFile(event.dataTransfer.files[0])
    },
    [selectFile]
  )
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      selectFile(event.target.files?.[0]),
    [selectFile]
  )

  return (
    <label
      className={cn(
        'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 border border-border border-dashed bg-outline p-4 text-center transition-colors hover:border-primary/60',
        isInvalid && 'border-destructive ring-2 ring-destructive/20',
        className
      )}
      onBlur={onBlur}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        accept={accept}
        className='hidden'
        id={id}
        onChange={handleInputChange}
        ref={inputRef}
        type='file'
      />
      {file ? (
        <>
          <HugeiconsIcon
            className='size-5 text-primary'
            icon={CheckmarkCircle02Icon}
          />
          <span className='font-mono font-semibold text-primary text-sm'>
            {file.name}
          </span>
          <span className='font-mono text-muted-foreground text-xs'>
            {(file.size / 1024 / 1024).toFixed(2)} MB · clique para alterar
          </span>
        </>
      ) : (
        <>
          <HugeiconsIcon
            className='size-5 text-muted-foreground'
            icon={Upload01Icon}
          />
          <span className='font-mono text-muted-foreground text-sm'>
            ARRASTE OU CLIQUE PARA ENVIAR
          </span>
          <span className='font-mono text-muted-foreground text-xs'>
            PDF, DOCX, TXT ou MD até 10MB
          </span>
        </>
      )}
    </label>
  )
}

export type { FileInputProps }
