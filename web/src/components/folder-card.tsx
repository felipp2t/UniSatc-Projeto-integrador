import { Folder02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useForm, useStore } from '@tanstack/react-form'
import { cn } from 'cn'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface FolderCardProps extends React.ComponentProps<'div'> {
  error?: string
  folderId: string
  isDeleting?: boolean
  itemCount: number
  name: string
  onDelete?: (folderId: string) => Promise<void> | void
  subfolderCount: number
}

export function FolderCard({
  folderId,
  name,
  itemCount,
  subfolderCount,
  onDelete,
  error,
  isDeleting = false,
  className,
  ...props
}: FolderCardProps) {
  const [open, setOpen] = useState(false)
  const [internalDeleteError, setInternalDeleteError] = useState<string>()
  const handleDelete = useCallback(async () => {
    setInternalDeleteError(undefined)
    try {
      await onDelete?.(folderId)
      setOpen(false)
    } catch (deleteError) {
      setInternalDeleteError(getErrorMessage(deleteError))
    }
  }, [folderId, onDelete])
  const closeDeleteDialog = useCallback(() => setOpen(false), [])
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-3 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50',
        className
      )}
      data-slot='folder-card'
      {...props}
    >
      <div className='flex items-center gap-2'>
        <span aria-hidden='true' className='text-lg text-primary'>
          <HugeiconsIcon icon={Folder02Icon} strokeWidth={2} />
        </span>
        <span className='min-w-0 truncate font-bold font-mono text-sm'>
          {name}
        </span>
      </div>
      <div className='flex items-center justify-between gap-3 font-mono text-muted-foreground text-xs uppercase'>
        <span>
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span>
          {subfolderCount} {subfolderCount === 1 ? 'subpasta' : 'subpastas'}
        </span>
      </div>
      {onDelete ? (
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger render={<Button size='sm' variant='destructive' />}>
            Excluir
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir pasta</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. “{name}” será excluída
                permanentemente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={closeDeleteDialog} variant='outline'>
                Cancelar
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDelete}
                variant='destructive'
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {(error ?? internalDeleteError) ? (
        <p className='text-destructive text-xs'>
          {error ?? internalDeleteError}
        </p>
      ) : null}
    </div>
  )
}

const folderSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
})

interface NewFolderCardProps {
  children: React.ReactNode
  error?: string
  isCreating?: boolean
  onCreate: (input: {
    workspaceId: string
    parentId?: string
    name: string
  }) => Promise<void> | void
  parentId?: string
  workspaceId: string
}

export function NewFolderCard({
  workspaceId,
  parentId,
  children,
  onCreate,
  error,
  isCreating = false,
}: NewFolderCardProps) {
  const [open, setOpen] = useState(false)
  const [internalError, setInternalError] = useState<string>()
  const formId = useId()
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value, formApi }) => {
      setInternalError(undefined)
      try {
        await onCreate({ name: value.name.trim(), parentId, workspaceId })
        formApi.reset()
        setOpen(false)
      } catch (submissionError) {
        setInternalError(getErrorMessage(submissionError))
      }
    },
    validators: { onSubmit: folderSchema },
  })
  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      form.handleSubmit()
    },
    [form]
  )
  const closeDialog = useCallback(() => setOpen(false), [])
  const formSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const submitting = isCreating || formSubmitting
  const displayedError = error ?? internalError
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={<button className='contents text-left' type='button' />}
      >
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
          <DialogDescription>
            Crie uma pasta para organizar seus itens.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <form.Field name='name'>
              {(field) => {
                const errorId = `${formId}-${field.name}-error`
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field invalid={invalid}>
                    <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                    <Input
                      aria-describedby={invalid ? errorId : undefined}
                      aria-invalid={invalid}
                      disabled={submitting}
                      id={field.name}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} id={errorId} />
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>
          <DialogFooter className='mt-4'>
            <Button onClick={closeDialog} type='button' variant='outline'>
              Cancelar
            </Button>
            {displayedError ? (
              <p className='text-destructive text-xs'>{displayedError}</p>
            ) : null}
            <Button disabled={submitting} type='submit'>
              {submitting ? 'Criando...' : 'Criar pasta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FolderCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-2 border-border bg-muted p-4',
        className
      )}
    >
      <Skeleton className='h-4 w-2/3' />
      <Skeleton className='h-3 w-1/2' />
    </div>
  )
}

export type { FolderCardProps, NewFolderCardProps }

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível criar a pasta.'
}
