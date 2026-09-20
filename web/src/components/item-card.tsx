import { ArchiveIcon, FileIcon, TrashIcon } from '@phosphor-icons/react'
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
export interface ItemCardProps extends React.ComponentProps<'div'> {
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
  const [internalError, setInternalError] = useState<string>()
  const archived = Boolean(item.archivedAt)
  const action = archived ? onRestore : onArchive
  const run = useCallback(
    async (callback?: (value: Item) => Promise<void> | void) => {
      setInternalError(undefined)
      try {
        await callback?.(item)
      } catch (cause) {
        setInternalError(errorMessage(cause))
      }
    },
    [item]
  )
  const handleActionClick = useCallback(() => {
    run(action).catch(() => undefined)
  }, [action, run])
  const handleDeleteClick = useCallback(() => {
    run(onDelete).catch(() => undefined)
  }, [onDelete, run])
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50',
        archived && 'opacity-60',
        className
      )}
      {...props}
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <FileIcon aria-hidden='true' className='size-4 text-primary' />
          <span className='truncate font-bold font-mono text-sm'>
            {item.title}
          </span>
        </div>
        <span className='border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase'>
          {item.type}
        </span>
      </div>
      {item.content ? (
        <p className='truncate text-muted-foreground text-xs'>{item.content}</p>
      ) : null}
      <div className='flex gap-2'>
        {action ? (
          <Button
            disabled={isMutating}
            onClick={handleActionClick}
            size='sm'
            variant='outline'
          >
            <ArchiveIcon aria-hidden='true' />
            {archived ? 'Restaurar' : 'Arquivar'}
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            disabled={isMutating}
            onClick={handleDeleteClick}
            size='sm'
            variant='destructive'
          >
            <TrashIcon aria-hidden='true' />
            Excluir
          </Button>
        ) : null}
      </div>
      {(error ?? internalError) ? (
        <p className='text-destructive text-xs'>{error ?? internalError}</p>
      ) : null}
    </div>
  )
}

const URL_PROTOCOL = /^https?:\/\//i
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
const ACCEPTED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']
const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
]

function normalizeUrl(value: string) {
  return URL_PROTOCOL.test(value) ? value : `https://${value}`
}

function isAcceptedDocument(file: File) {
  const mimeType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()
  return (
    ACCEPTED_DOCUMENT_MIME_TYPES.includes(mimeType) ||
    ACCEPTED_DOCUMENT_EXTENSIONS.some((extension) =>
      fileName.endsWith(extension)
    )
  )
}

const itemSchemaBase = z.object({
  title: z.string().trim().min(3, 'O título deve ter pelo menos 3 caracteres.'),
  type: z.enum(itemTypes),
})
const itemSchema = z.discriminatedUnion('type', [
  itemSchemaBase.extend({
    content: z
      .file('Envie um arquivo válido.')
      .max(MAX_DOCUMENT_SIZE, 'O arquivo deve ter até 10MB.')
      .refine(
        isAcceptedDocument,
        'Formato não suportado. Envie PDF, DOCX, TXT ou MD.'
      ),
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

interface ContentField {
  handleBlur: () => void
  handleChange: (value: string | File) => void
  value: string | File
}

function ItemContentControl({
  describedBy,
  field,
  invalid,
  type,
  disabled,
}: {
  describedBy?: string
  disabled: boolean
  field: ContentField
  invalid?: boolean
  type: ItemType
}) {
  const stringValue = typeof field.value === 'string' ? field.value : ''
  if (type === 'document') {
    return (
      <FileInput
        accept='.pdf,.docx,.txt,.md'
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
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
        value={stringValue}
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
        value={stringValue}
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
      value={stringValue}
    />
  )
}

function ItemTypeSelect({
  describedBy,
  invalid,
  onChange,
  value,
}: {
  describedBy?: string
  invalid?: boolean
  onChange: (value: ItemType) => void
  value: ItemType
}) {
  const handleChange = useCallback(
    (nextValue: string) => onChange(nextValue as ItemType),
    [onChange]
  )
  return (
    <Select onValueChange={handleChange} value={value}>
      <SelectTrigger
        aria-describedby={describedBy}
        aria-invalid={invalid}
        id='item-type'
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
export interface NewItemCardProps {
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
  trigger: React.ReactElement
  workspaceId: string
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
      } catch (cause) {
        setInternalError(errorMessage(cause))
      }
    },
    validators: { onSubmit: itemSchema },
  })

  const formSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const submitting = isCreating || formSubmitting
  const selectedType = useSelector(form.store, (state) => state.values.type)
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
          <DialogTitle>Novo item</DialogTitle>
          <DialogDescription>Adicione conteúdo ao workspace.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <form.Field name='title'>
              {(field) => {
                const errorId = `${formId}-${field.name}-error`
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field invalid={invalid}>
                    <FieldLabel htmlFor='item-title'>Título</FieldLabel>
                    <Input
                      aria-describedby={invalid ? errorId : undefined}
                      aria-invalid={invalid}
                      disabled={submitting}
                      id='item-title'
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
                      invalid={invalid}
                      onChange={field.handleChange}
                      value={field.state.value}
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
            {displayedError ? (
              <p className='text-destructive text-xs'>{displayedError}</p>
            ) : null}
            <Button onClick={closeDialog} type='button' variant='outline'>
              Cancelar
            </Button>
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
      <div className='h-4 w-3/5 animate-pulse bg-muted-foreground/20' />
      <div className='h-3 w-4/5 animate-pulse bg-muted-foreground/20' />
    </div>
  )
}
function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'Não foi possível concluir a operação.'
}
