import { FolderIcon, TrashIcon } from '@phosphor-icons/react'
import { useForm, useSelector } from '@tanstack/react-form'
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

export interface FolderCardProps extends React.ComponentProps<'div'> {
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
  const [internalError, setInternalError] = useState<string>()
  const handleDelete = useCallback(async () => {
    setInternalError(undefined)
    try {
      await onDelete?.(folderId)
      setOpen(false)
    } catch (cause) {
      setInternalError(errorMessage(cause))
    }
  }, [folderId, onDelete])
  const closeDialog = useCallback(() => setOpen(false), [])
  const handleDeleteClick = useCallback(() => {
    handleDelete().catch(() => undefined)
  }, [handleDelete])
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-3 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50',
        className
      )}
      {...props}
    >
      <div className='flex items-center gap-2'>
        <FolderIcon aria-hidden='true' className='size-5 text-primary' />
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
          <DialogTrigger asChild>
            <Button size='sm' variant='destructive'>
              <TrashIcon aria-hidden='true' />
              Excluir
            </Button>
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
              <Button onClick={closeDialog} type='button' variant='outline'>
                Cancelar
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDeleteClick}
                variant='destructive'
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {(error ?? internalError) ? (
        <p className='text-destructive text-xs'>{error ?? internalError}</p>
      ) : null}
    </div>
  )
}

export interface NewFolderCardProps {
  error?: string
  isCreating?: boolean
  onCreate: (input: {
    workspaceId: string
    parentId?: string
    name: string
  }) => Promise<void> | void
  parentId?: string
  trigger: React.ReactElement
  workspaceId: string
}
export function NewFolderCard({
  workspaceId,
  parentId,
  onCreate,
  error,
  isCreating = false,
  trigger,
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
      } catch (cause) {
        setInternalError(errorMessage(cause))
      }
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(3, 'O nome deve ter pelo menos 3 caracteres.'),
      }),
    },
  })
  const formSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const submitting = isCreating || formSubmitting
  const displayedError = error ?? internalError
  const closeDialog = useCallback(() => setOpen(false), [])
  const submit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      form.handleSubmit().catch(() => undefined)
    },
    [form]
  )
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
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
                    <FieldLabel htmlFor='folder-name'>Nome</FieldLabel>
                    <Input
                      aria-describedby={invalid ? errorId : undefined}
                      aria-invalid={invalid}
                      disabled={submitting}
                      id='folder-name'
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
            {displayedError ? (
              <p className='text-destructive text-xs'>{displayedError}</p>
            ) : null}
            <Button onClick={closeDialog} type='button' variant='outline'>
              Cancelar
            </Button>
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
      <div className='h-4 w-2/3 animate-pulse bg-muted-foreground/20' />
      <div className='h-3 w-1/2 animate-pulse bg-muted-foreground/20' />
    </div>
  )
}
function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'Não foi possível concluir a operação.'
}
