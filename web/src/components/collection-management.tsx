import {
  DotsThreeVerticalIcon,
  FolderIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { CollectionResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const collectionNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe um nome para a pasta.')
  .max(255, 'O nome deve ter no máximo 255 caracteres.')

export type CollectionDialogState =
  | { type: 'create' }
  | { type: 'rename'; collection: CollectionResponse }
  | { type: 'delete'; collection: CollectionResponse }
  | null

type CollectionNameAction = 'create' | 'rename'
type CollectionDeleteAction = 'delete'

export function CollectionCard({
  collection,
  onDelete,
  onRename,
}: {
  collection: CollectionResponse
  onDelete: (collection: CollectionResponse) => void
  onRename: (collection: CollectionResponse) => void
}) {
  const handleDelete = useCallback(
    () => onDelete({ ...collection }),
    [collection, onDelete]
  )
  const handleRename = useCallback(
    () => onRename({ ...collection }),
    [collection, onRename]
  )

  return (
    <article className='relative flex min-h-24 flex-col justify-between gap-4 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50'>
      <div className='flex min-w-0 items-start justify-between gap-2'>
        <Link
          className="group flex min-w-0 items-center gap-2 after:absolute after:inset-0 after:rounded-sm after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
          search={{ collectionId: collection.id }}
          to='/'
        >
          <FolderIcon
            aria-hidden='true'
            className='size-5 shrink-0 text-muted-foreground group-hover:text-primary'
          />
          <span className='truncate font-bold font-mono text-sm uppercase tracking-wide'>
            {collection.name}
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Ações de ${collection.name}`}
              className='relative z-10 shrink-0 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground'
              type='button'
            >
              <DotsThreeVerticalIcon aria-hidden='true' className='size-4' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onSelect={handleRename}>
              <PencilSimpleIcon aria-hidden='true' />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDelete} variant='destructive'>
              <TrashIcon aria-hidden='true' />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className='font-mono text-[10px] text-muted-foreground uppercase tracking-wider'>
        Pasta
      </span>
    </article>
  )
}

export function CollectionDialogHost({
  dialog,
  isPending,
  onClose,
  onCreate,
  onDelete,
  onRename,
}: {
  dialog: CollectionDialogState
  isPending: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onDelete: (collection: CollectionResponse) => Promise<void>
  onRename: (collection: CollectionResponse, name: string) => Promise<void>
}) {
  if (!dialog) return null

  if (dialog.type === 'delete') {
    return (
      <DeleteCollectionDialog
        collection={dialog.collection}
        isPending={isPending}
        onClose={onClose}
        onDelete={onDelete}
      />
    )
  }

  return (
    <CollectionNameDialog
      collection={dialog.type === 'rename' ? dialog.collection : undefined}
      isPending={isPending}
      mode={dialog.type}
      onClose={onClose}
      onCreate={onCreate}
      onRename={onRename}
    />
  )
}

function CollectionNameDialog({
  collection,
  isPending,
  mode,
  onClose,
  onCreate,
  onRename,
}: {
  collection: CollectionResponse | undefined
  isPending: boolean
  mode: CollectionNameAction
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (collection: CollectionResponse, name: string) => Promise<void>
}) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [name, setName] = useState(collection?.name ?? '')
  const [error, setError] = useState<string>()
  const isRename = mode === 'rename'

  const close = useCallback(() => {
    if (!isPending) onClose()
  }, [isPending, onClose])
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close()
    },
    [close]
  )
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setError(undefined)
  }, [])

  const submit = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      setError(undefined)

      const result = collectionNameSchema.safeParse(name)
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? 'Informe um nome válido.')
        return
      }

      if (isRename && result.data === collection?.name.trim()) {
        onClose()
        return
      }

      try {
        if (isRename && collection) {
          await onRename(collection, result.data)
        } else {
          await onCreate(result.data)
        }
      } catch (cause) {
        setError(getCollectionMutationError(cause, mode))
      }
    },
    [collection, isRename, mode, name, onClose, onCreate, onRename]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRename ? 'Renomear pasta' : 'Nova pasta'}
          </DialogTitle>
          <DialogDescription>
            {isRename
              ? 'Altere o nome desta pasta.'
              : 'Crie uma pasta para organizar seus itens.'}
          </DialogDescription>
        </DialogHeader>
        <form className='space-y-4' onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor={inputId}>Nome</FieldLabel>
            <Input
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete='off'
              disabled={isPending}
              id={inputId}
              maxLength={255}
              onValueChange={handleNameChange}
              value={name}
            />
          </Field>
          {error ? (
            <p className='text-destructive text-xs' id={errorId} role='alert'>
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button disabled={isPending} onClick={close} variant='outline'>
              Cancelar
            </Button>
            <Button loading={isPending} type='submit'>
              {isPending
                ? isRename
                  ? 'Salvando…'
                  : 'Criando…'
                : isRename
                  ? 'Salvar'
                  : 'Criar pasta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCollectionDialog({
  collection,
  isPending,
  onClose,
  onDelete,
}: {
  collection: CollectionResponse
  isPending: boolean
  onClose: () => void
  onDelete: (collection: CollectionResponse) => Promise<void>
}) {
  const [error, setError] = useState<string>()
  const close = useCallback(() => {
    if (!isPending) onClose()
  }, [isPending, onClose])
  const confirm = useCallback(async () => {
    setError(undefined)
    try {
      await onDelete(collection)
    } catch (cause) {
      setError(getCollectionMutationError(cause, 'delete'))
    }
  }, [collection, onDelete])
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close()
    },
    [close]
  )
  const handleConfirm = useCallback(() => {
    confirm().catch(() => undefined)
  }, [confirm])

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir pasta</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. “{collection.name}” será excluída
            permanentemente.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className='text-destructive text-xs' role='alert'>
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={isPending} onClick={close} variant='outline'>
            Cancelar
          </Button>
          <Button
            loading={isPending}
            onClick={handleConfirm}
            variant='destructive'
          >
            {isPending ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getCollectionMutationError(
  cause: unknown,
  action: CollectionNameAction | CollectionDeleteAction
) {
  const statusMessages: Record<number, string> = {
    403: 'Você não tem permissão para esta ação.',
    409:
      action === 'delete'
        ? 'Esta pasta contém itens ou subpastas e não pode ser excluída.'
        : 'Já existe uma pasta com esse nome nesta localização.',
  }
  if (action !== 'create') {
    statusMessages[404] =
      'Esta pasta não está mais disponível. A listagem foi atualizada.'
  }
  return getApiErrorMessage(cause, {
    fallback: 'Não foi possível concluir a operação.',
    network:
      action === 'create'
        ? 'Não foi possível confirmar a criação. Confira a listagem antes de tentar novamente.'
        : 'Não foi possível concluir. Tente novamente.',
    statusMessages,
    useServerMessage: true,
  })
}

export function CreateCollectionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <PlusIcon aria-hidden='true' size={15} />
      Nova pasta
    </Button>
  )
}
