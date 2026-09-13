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
export interface Workspace {
  createdAt?: string
  id: string
  itemCount?: number
  name: string
}
interface WorkspaceCardProps extends React.ComponentProps<'div'> {
  error?: string
  isDeleting?: boolean
  onDelete?: (workspaceId: string) => Promise<void> | void
  settingsHref?: string
  workspace: Workspace
  workspaceHref?: string
}
interface NewWorkspaceCardProps {
  error?: string
  isCreating?: boolean
  onCreate: (name: string) => Promise<void> | void
  /** Semantic, focusable trigger without nested interactive controls. */
  trigger: React.ReactElement
}
export function WorkspaceCard({
  workspace,
  workspaceHref = '#',
  settingsHref = '#',
  onDelete,
  error,
  isDeleting = false,
  className,
  ...props
}: WorkspaceCardProps) {
  const [internalDeleteError, setInternalDeleteError] = useState<string>()
  const handleDelete = useCallback(async () => {
    setInternalDeleteError(undefined)
    try {
      await onDelete?.(workspace.id)
    } catch (deleteError) {
      setInternalDeleteError(getErrorMessage(deleteError))
    }
  }, [onDelete, workspace.id])
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-2 border-border bg-card p-5',
        className
      )}
      {...props}
    >
      <div className='flex items-start justify-between gap-3'>
        <div>
          <a
            className='font-bold font-mono text-lg hover:text-primary'
            href={workspaceHref}
          >
            {workspace.name}
          </a>
          <p className='mt-1 text-muted-foreground text-xs'>
            {workspace.itemCount ?? 0} itens
          </p>
        </div>
        <a
          className='text-muted-foreground text-xs underline'
          href={settingsHref}
        >
          Configurar
        </a>
      </div>
      {onDelete ? (
        <Button
          disabled={isDeleting}
          onClick={handleDelete}
          size='sm'
          variant='destructive'
        >
          Excluir
        </Button>
      ) : null}
      {(error ?? internalDeleteError) ? (
        <p className='text-destructive text-xs'>
          {error ?? internalDeleteError}
        </p>
      ) : null}
    </div>
  )
}
export function NewWorkspaceCard({
  onCreate,
  error: externalError,
  isCreating = false,
  trigger,
}: NewWorkspaceCardProps) {
  const [open, setOpen] = useState(false)
  const [internalError, setInternalError] = useState<string>()
  const formId = useId()
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value, formApi }) => {
      setInternalError(undefined)
      try {
        await onCreate(value.name.trim())
        formApi.reset()
        setOpen(false)
      } catch (submissionError) {
        setInternalError(getErrorMessage(submissionError))
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
  const submitting = useStore(form.store, (state) => state.isSubmitting)
  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      form.handleSubmit()
    },
    [form]
  )
  const closeDialog = useCallback(() => setOpen(false), [])
  const error = externalError ?? internalError
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo workspace</DialogTitle>
          <DialogDescription>
            Crie um workspace para organizar seus itens.
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
                      disabled={isCreating || submitting}
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
            {error ? <p className='text-destructive text-xs'>{error}</p> : null}
            <Button onClick={closeDialog} type='button' variant='outline'>
              Cancelar
            </Button>
            <Button disabled={isCreating || submitting} type='submit'>
              {isCreating || submitting ? 'Criando...' : 'Criar workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export function WorkspaceCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-2 border-border bg-muted p-5',
        className
      )}
    >
      <div className='h-5 w-1/2 animate-pulse bg-muted-foreground/20' />
      <div className='h-3 w-1/3 animate-pulse bg-muted-foreground/20' />
    </div>
  )
}
export type { NewWorkspaceCardProps, WorkspaceCardProps }

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}
