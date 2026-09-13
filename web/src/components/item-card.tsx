import { File02Icon } from '@hugeicons/core-free-icons'
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
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export const itemTypes = ['document', 'link', 'secret', 'text'] as const
export type ItemType = (typeof itemTypes)[number]
export interface Item {
  archivedAt?: string | null
  content?: string
  id: string
  title: string
  type: ItemType
}

interface ItemCardProps extends React.ComponentProps<'div'> {
  error?: string
  isMutating?: boolean
  item: Item
  onArchive?: (item: Item) => Promise<void> | void
  onDelete?: (item: Item) => Promise<void> | void
  onRestore?: (item: Item) => Promise<void> | void
}

export function ItemCard({
  item,
  onArchive,
  onRestore,
  onDelete,
  isMutating = false,
  error,
  className,
  ...props
}: ItemCardProps) {
  const archived = Boolean(item.archivedAt)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [internalMutationError, setInternalMutationError] = useState<string>()
  const action = archived ? onRestore : onArchive
  const handleAction = useCallback(async () => {
    setInternalMutationError(undefined)
    try {
      await action?.(item)
    } catch (mutationError) {
      setInternalMutationError(getErrorMessage(mutationError))
    }
  }, [action, item])
  const closeDeleteDialog = useCallback(() => setDeleteOpen(false), [])
  const handleDelete = useCallback(async () => {
    setInternalMutationError(undefined)
    try {
      await onDelete?.(item)
      setDeleteOpen(false)
    } catch (mutationError) {
      setInternalMutationError(getErrorMessage(mutationError))
    }
  }, [item, onDelete])
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50',
        archived && 'opacity-60',
        className
      )}
      data-slot='item-card'
      {...props}
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <HugeiconsIcon
            aria-hidden='true'
            className='size-4 text-primary'
            icon={File02Icon}
          />
          <span className='truncate font-bold font-mono text-sm'>
            {item.title}
          </span>
        </div>
        <span className='border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase'>
          {item.type}
        </span>
      </div>
      {item.content ? (
        <p className='truncate font-mono text-muted-foreground text-xs'>
          {item.type === 'secret' ? '••••••••••' : item.content}
        </p>
      ) : null}
      <div className='flex gap-2'>
        {action ? (
          <Button
            disabled={isMutating}
            onClick={handleAction}
            size='sm'
            variant='outline'
          >
            {archived ? 'Restaurar' : 'Arquivar'}
          </Button>
        ) : null}
        {onDelete ? (
          <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
            <DialogTrigger
              render={
                <Button disabled={isMutating} size='sm' variant='destructive' />
              }
            >
              Excluir
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir item</DialogTitle>
                <DialogDescription>
                  “{item.title}” será excluído permanentemente.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={closeDeleteDialog} variant='outline'>
                  Cancelar
                </Button>
                <Button
                  disabled={isMutating}
                  onClick={handleDelete}
                  variant='destructive'
                >
                  Excluir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      {(error ?? internalMutationError) ? (
        <p className='text-destructive text-xs'>
          {error ?? internalMutationError}
        </p>
      ) : null}
    </div>
  )
}

const itemSchemaBase = z.object({
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres.'),
  type: z.enum(itemTypes),
})
const itemSchema = z.discriminatedUnion('type', [
  itemSchemaBase.extend({
    content: z.file('Envie um arquivo válido.'),
    type: z.literal('document'),
  }),
  itemSchemaBase.extend({
    content: z.string().min(1, 'Informe o segredo.'),
    type: z.literal('secret'),
  }),
  itemSchemaBase.extend({
    content: z
      .string()
      .min(1, 'Informe uma URL.')
      .refine(
        (value) => z.url().safeParse(normalizeUrl(value)).success,
        'Informe uma URL válida.'
      ),
    type: z.literal('link'),
  }),
  itemSchemaBase.extend({
    content: z.string().min(1, 'Informe o conteúdo.'),
    type: z.literal('text'),
  }),
])

const URL_PROTOCOL = /^https?:\/\//i
function normalizeUrl(value: string) {
  return URL_PROTOCOL.test(value) ? value : `https://${value}`
}
interface NewItemCardProps {
  error?: string
  folderId?: string
  isCreating?: boolean
  onCreate: (input: {
    workspaceId: string
    folderId?: string
    title: string
    type: ItemType
    content: File | string
  }) => Promise<void> | void
  /** Semantic, focusable trigger without nested interactive controls. */
  trigger: React.ReactElement
  workspaceId: string
}

interface ContentField {
  handleBlur: () => void
  handleChange: (value: string | File) => void
  value: string | File
}

interface TypeField {
  handleChange: (value: ItemType) => void
  value: ItemType
}

function ItemTypeSelect({
  field,
  describedBy,
  invalid,
  disabled,
}: {
  field: TypeField
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const handleChange = useCallback(
    (value: string | null) => {
      if (value) field.handleChange(value as ItemType)
    },
    [field]
  )
  return (
    <Select id='item-type' onValueChange={handleChange} value={field.value}>
      <SelectTrigger
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {itemTypes.map((type) => (
          <SelectItem key={type} value={type}>
            {type}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ItemContentControl({
  field,
  type,
  describedBy,
  invalid,
  disabled,
}: {
  field: ContentField
  type: ItemType
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
}) {
  if (type === 'document') {
    return (
      <FileInput
        aria-describedby={describedBy}
        aria-invalid={invalid}
        id='item-content'
        isInvalid={invalid}
        onBlur={field.handleBlur}
        onChange={field.handleChange}
        value={field.value instanceof File ? field.value : null}
      />
    )
  }
  if (type === 'secret') {
    return (
      <SecretInput
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
        id='item-content'
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
        value={typeof field.value === 'string' ? field.value : ''}
      />
    )
  }
  if (type === 'text') {
    return (
      <Textarea
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
        id='item-content'
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
        value={typeof field.value === 'string' ? field.value : ''}
      />
    )
  }
  return (
    <Input
      aria-describedby={describedBy}
      aria-invalid={invalid}
      disabled={disabled}
      id='item-content'
      onBlur={field.handleBlur}
      onValueChange={field.handleChange}
      placeholder='example.com'
      value={typeof field.value === 'string' ? field.value : ''}
    />
  )
}

export function NewItemCard({
  trigger,
  workspaceId,
  folderId,
  onCreate,
  error,
  isCreating = false,
}: NewItemCardProps) {
  const [open, setOpen] = useState(false)
  const [internalError, setInternalError] = useState<string>()
  const formId = useId()
  const form = useForm({
    defaultValues: {
      content: '' as File | string,
      title: '',
      type: 'document' as ItemType,
    },
    onSubmit: async ({ value, formApi }) => {
      setInternalError(undefined)
      try {
        await onCreate({
          content:
            value.type === 'link' && typeof value.content === 'string'
              ? normalizeUrl(value.content)
              : value.content,
          folderId,
          title: value.title.trim(),
          type: value.type,
          workspaceId,
        })
        formApi.reset()
        setOpen(false)
      } catch (submissionError) {
        setInternalError(getErrorMessage(submissionError))
      }
    },
    validators: { onSubmit: itemSchema },
  })
  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      form.handleSubmit()
    },
    [form]
  )
  const closeDialog = useCallback(() => setOpen(false), [])
  const selectedType = useStore(form.store, (state) => state.values.type)
  const formSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const submitting = isCreating || formSubmitting
  const displayedError = error ?? internalError
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo item</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <form.Field name='title'>
              {(field) => {
                const errorId = `${formId}-${field.name}-error`
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field invalid={invalid}>
                    <FieldLabel htmlFor={field.name}>Título</FieldLabel>
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
            <form.Field name='type'>
              {(field) => {
                const errorId = `${formId}-${field.name}-error`
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field invalid={invalid}>
                    <FieldLabel htmlFor='item-type'>Tipo</FieldLabel>
                    <ItemTypeSelect
                      describedBy={invalid ? errorId : undefined}
                      disabled={submitting}
                      field={{
                        handleChange: field.handleChange,
                        value: field.state.value,
                      }}
                      invalid={invalid}
                    />
                    <FieldError errors={field.state.meta.errors} id={errorId} />
                  </Field>
                )
              }}
            </form.Field>
            <form.Field name='content'>
              {(field) => {
                const errorId = `${formId}-${field.name}-error`
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field invalid={invalid}>
                    <FieldLabel htmlFor='item-content'>Conteúdo</FieldLabel>
                    <ItemContentControl
                      describedBy={invalid ? errorId : undefined}
                      disabled={submitting}
                      field={{
                        handleBlur: field.handleBlur,
                        handleChange: field.handleChange,
                        value: field.state.value,
                      }}
                      invalid={invalid}
                      type={selectedType}
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
              {submitting ? 'Criando...' : 'Criar item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ItemCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-2 border-border bg-muted p-4',
        className
      )}
    >
      <Skeleton className='h-4 w-3/5' />
      <Skeleton className='h-3 w-4/5' />
    </div>
  )
}
export type { ItemCardProps, NewItemCardProps }

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}
