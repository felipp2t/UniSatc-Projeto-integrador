import { useForm } from '@tanstack/react-form'
import { cn } from 'cn'
import { useCallback, useState } from 'react'
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
  const handleDelete = useCallback(async () => {
    await onDelete?.(folderId)
    setOpen(false)
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
          ▰
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
      {error ? <p className='text-destructive text-xs'>{error}</p> : null}
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
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value, formApi }) => {
      await onCreate({ name: value.name.trim(), parentId, workspaceId })
      formApi.reset()
      setOpen(false)
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
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<div className='cursor-pointer' />}>
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
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                  <Input
                    id={field.name}
                    onBlur={field.handleBlur}
                    onValueChange={field.handleChange}
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter className='mt-4'>
            <Button onClick={closeDialog} type='button' variant='outline'>
              Cancelar
            </Button>
            {error ? <p className='text-destructive text-xs'>{error}</p> : null}
            <Button disabled={isCreating} type='submit'>
              {isCreating ? 'Criando...' : 'Criar pasta'}
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
