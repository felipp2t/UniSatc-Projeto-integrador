import { FolderIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isUnavailableCollectionError } from '@/api/collection-errors'
import { collectionKeys } from '@/api/collection-keys'
import { collectionsApi } from '@/api/endpoints'
import type { CollectionPageResponse, CollectionResponse } from '@/api/types'
import {
  CollectionCard,
  CollectionDialogHost,
  type CollectionDialogState,
} from '@/components/collection-management'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { appToast } from '@/components/ui/toast'
import { useCollectionMutations } from '@/hooks/use-collection-mutations'

export function WorkspaceCollections({
  collectionId,
  pathUnavailable,
  workspaceId,
  createCollectionSignal,
  onCollectionDialogOpened,
}: {
  collectionId: string | undefined
  pathUnavailable: boolean
  workspaceId: string
  createCollectionSignal: boolean
  onCollectionDialogOpened: () => void
}) {
  const navigate = useNavigate()
  const collectionMutations = useCollectionMutations()
  const [dialog, setDialog] = useState<CollectionDialogState>(null)
  const [page, setPage] = useState(0)
  const collections = useQuery({
    placeholderData: (previousData) => previousData,
    queryFn: async () =>
      (await collectionsApi.list(workspaceId, collectionId, page, 100)).data,
    queryKey: collectionKeys.list(workspaceId, collectionId, page),
  })
  const unavailable =
    Boolean(collectionId) &&
    (pathUnavailable ||
      isUnavailableCollectionError(collections.error, 'list', page))
  const lastNotifiedCollectionId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!(collectionId && unavailable)) return
    if (lastNotifiedCollectionId.current === collectionId) return

    lastNotifiedCollectionId.current = collectionId
    toast.error('Esta pasta não está disponível ou você não tem acesso.')
    navigate({
      replace: true,
      search: (previous) => ({ ...previous, collectionId: undefined }),
      to: '/',
    }).catch(() => undefined)
  }, [collectionId, navigate, unavailable])

  const { data } = collections
  useEffect(() => {
    if (!createCollectionSignal) return
    setDialog({ type: 'create' })
    onCollectionDialogOpened()
  }, [createCollectionSignal, onCollectionDialogOpened])

  useEffect(() => {
    if (
      !collections.isSuccess ||
      collections.isFetching ||
      collections.isPlaceholderData ||
      !data ||
      page === 0 ||
      data.items.length > 0 ||
      page < data.totalPages
    ) {
      return
    }

    setPage(Math.max(0, data.totalPages - 1))
  }, [
    collections.isFetching,
    collections.isPlaceholderData,
    collections.isSuccess,
    data,
    page,
  ])

  const closeDialog = useCallback(() => setDialog(null), [])
  const retry = useCallback(async () => {
    await collections.refetch()
  }, [collections.refetch])
  const openDelete = useCallback(
    (collection: CollectionResponse) =>
      setDialog({ collection, type: 'delete' }),
    []
  )
  const openRename = useCallback(
    (collection: CollectionResponse) =>
      setDialog({ collection, type: 'rename' }),
    []
  )
  const nextPage = useCallback(() => setPage((current) => current + 1), [])
  const previousPage = useCallback(
    () => setPage((current) => Math.max(0, current - 1)),
    []
  )
  const create = useCallback(
    async (name: string) => {
      await collectionMutations.create.mutateAsync({
        request: { name, parentId: collectionId },
        workspaceId,
      })
      appToast.success('Pasta criada.')
      closeDialog()
    },
    [closeDialog, collectionId, collectionMutations.create, workspaceId]
  )
  const rename = useCallback(
    async (collection: CollectionResponse, name: string) => {
      await collectionMutations.rename.mutateAsync({
        collectionId: collection.id,
        name,
        parentId: collection.parentId ?? undefined,
        workspaceId,
      })
      appToast.success('Pasta renomeada.')
      closeDialog()
    },
    [closeDialog, collectionMutations.rename, workspaceId]
  )
  const remove = useCallback(
    async (collection: CollectionResponse) => {
      await collectionMutations.remove.mutateAsync({
        collectionId: collection.id,
        parentId: collection.parentId ?? undefined,
        workspaceId,
      })
      appToast.success('Pasta excluída.')
      closeDialog()
    },
    [closeDialog, collectionMutations.remove, workspaceId]
  )
  const pending =
    (dialog?.type === 'create' && collectionMutations.create.isPending) ||
    (dialog?.type === 'rename' && collectionMutations.rename.isPending) ||
    (dialog?.type === 'delete' && collectionMutations.remove.isPending)

  if (unavailable) return <LoadingState label='Voltando ao workspace…' />

  return (
    <>
      <CollectionDialogHost
        dialog={dialog}
        isPending={pending}
        onClose={closeDialog}
        onCreate={create}
        onDelete={remove}
        onRename={rename}
      />
      <CollectionsSection
        collectionId={collectionId}
        collections={data}
        error={collections.error}
        isError={collections.isError}
        isFetching={collections.isFetching}
        isPlaceholderData={collections.isPlaceholderData}
        onDelete={openDelete}
        onNextPage={nextPage}
        onPreviousPage={previousPage}
        onRename={openRename}
        onRetry={retry}
        page={page}
      />
    </>
  )
}

function CollectionsSection({
  collectionId,
  collections,
  error,
  isError,
  isFetching,
  isPlaceholderData,
  onNextPage,
  onDelete,
  onPreviousPage,
  onRename,
  onRetry,
  page,
}: {
  collectionId: string | undefined
  collections: CollectionPageResponse | undefined
  error: Error | null
  isError: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  onNextPage: () => void
  onDelete: (collection: CollectionResponse) => void
  onPreviousPage: () => void
  onRename: (collection: CollectionResponse) => void
  onRetry: () => void | Promise<void>
  page: number
}) {
  if (isError) return <ErrorState error={error} onRetry={onRetry} />
  if (!collections) return <LoadingState label='Carregando pastas…' />

  if (collections.items.length === 0) {
    if (isPlaceholderData || (page > 0 && page >= collections.totalPages)) {
      return <LoadingState label='Carregando pastas…' />
    }

    return (
      <section aria-labelledby='collections-heading' className='space-y-3'>
        <h2
          className='font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest'
          id='collections-heading'
        >
          Pastas
        </h2>
        <EmptyState
          description={
            collectionId
              ? 'Esta pasta ainda não tem subpastas.'
              : 'Este workspace ainda não tem pastas.'
          }
          icon={<FolderIcon aria-hidden='true' className='size-6' />}
          title='Nenhuma pasta encontrada'
          variant='compact'
        />
      </section>
    )
  }

  return (
    <section aria-labelledby='collections-heading' className='space-y-3'>
      <h2
        className='font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest'
        id='collections-heading'
      >
        Pastas
      </h2>
      <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4'>
        {collections.items.map((folder) => (
          <CollectionCard
            collection={folder}
            key={folder.id}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>
      {collections.totalPages > 1 ? (
        <PaginationControls
          isFetching={isFetching || isPlaceholderData}
          onNext={onNextPage}
          onPrevious={onPreviousPage}
          page={page}
          totalPages={collections.totalPages}
        />
      ) : null}
    </section>
  )
}

export function PaginationControls({
  isFetching,
  onNext,
  onPrevious,
  page,
  totalPages,
}: {
  isFetching: boolean
  onNext: () => void
  onPrevious: () => void
  page: number
  totalPages: number
}) {
  return (
    <div className='flex items-center justify-between border-border border-t pt-4'>
      <span className='font-mono text-muted-foreground text-xs'>
        Página {page + 1} de {totalPages}
      </span>
      <div className='flex gap-2'>
        <Button
          disabled={page === 0 || isFetching}
          onClick={onPrevious}
          size='sm'
          variant='outline'
        >
          Anterior
        </Button>
        <Button
          disabled={page + 1 >= totalPages || isFetching}
          onClick={onNext}
          size='sm'
          variant='outline'
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
