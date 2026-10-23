import {
  ArchiveIcon,
  DotsThreeVerticalIcon,
  FileIcon,
  FolderIcon,
  KeyIcon,
  LinkIcon,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { isUnavailableCollectionError } from '@/api/collection-errors'
import { collectionKeys } from '@/api/collection-keys'
import { collectionsApi, itemsApi, workspaceApi } from '@/api/endpoints'
import type {
  CollectionPageResponse,
  CollectionPathEntry,
  ItemPageResponse,
  ItemResponse,
} from '@/api/types'
import { CreateItemDialog } from '@/components/create-item-dialog'
import { NotFoundPage } from '@/components/not-found-page'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollectionPath } from '@/hooks/use-collection-path'

const searchSchema = z.object({
  collectionId: z.guid().optional().catch(undefined),
})
const itemTypeOptions = ['all', 'text', 'link', 'secret'] as const
type ItemTypeFilter = (typeof itemTypeOptions)[number]

export const Route = createFileRoute('/_protected/')({
  component: HomePage,
  head: () => ({ meta: [{ title: 'Vaulty' }] }),
  notFoundComponent: NotFoundPage,
  validateSearch: searchSchema,
})

function HomePage() {
  const { collectionId } = Route.useSearch()
  const workspaces = useQuery({
    queryFn: async () => (await workspaceApi.list()).data,
    queryKey: ['workspaces'],
  })
  const workspace = workspaces.data?.[0]
  const retryWorkspaces = useCallback(async () => {
    await workspaces.refetch()
  }, [workspaces.refetch])

  if (workspaces.isPending)
    return <LoadingState label='Carregando workspace…' />
  if (workspaces.isError) {
    return <ErrorState error={workspaces.error} onRetry={retryWorkspaces} />
  }
  if (!workspace?.id) {
    return (
      <main className='mx-auto w-full max-w-7xl px-6 py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar os itens.'
          title='Nenhum workspace disponível'
        />
      </main>
    )
  }

  return (
    <WorkspaceBrowser
      collectionId={collectionId}
      // Remounting per folder prevents folder-scoped state and data from leaking.
      key={`${workspace.id}:${collectionId ?? 'root'}`}
      workspaceId={workspace.id}
      workspaceName={workspace.name ?? 'Workspace'}
    />
  )
}

function WorkspaceBrowser({
  collectionId,
  workspaceId,
  workspaceName,
}: {
  collectionId: string | undefined
  workspaceId: string
  workspaceName: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const path = useCollectionPath(workspaceId, collectionId)
  const [collectionsPage, setCollectionsPage] = useState(0)
  const collections = useQuery({
    placeholderData: (previousData) => previousData,
    queryFn: async () =>
      (
        await collectionsApi.list(
          workspaceId,
          collectionId,
          collectionsPage,
          100
        )
      ).data,
    queryKey: collectionKeys.list(workspaceId, collectionId, collectionsPage),
  })
  const {
    data: collectionsData,
    isFetching: isFetchingCollections,
    isPlaceholderData: isPlaceholderCollections,
    isSuccess: isCollectionsSuccess,
  } = collections
  const lastNotifiedCollectionId = useRef<string | undefined>(undefined)
  const pathUnavailable = isUnavailableCollectionError(path.error, 'path')
  const collectionsUnavailable = isUnavailableCollectionError(
    collections.error,
    'list',
    collectionsPage
  )
  const unavailableCollection =
    Boolean(collectionId) && (pathUnavailable || collectionsUnavailable)

  useEffect(() => {
    if (!(collectionId && unavailableCollection)) return
    if (lastNotifiedCollectionId.current === collectionId) return

    lastNotifiedCollectionId.current = collectionId
    toast.error('Esta pasta não está disponível ou você não tem acesso.')
    navigate({
      replace: true,
      search: (previous) => ({ ...previous, collectionId: undefined }),
      to: '/',
    }).catch(() => undefined)
  }, [collectionId, navigate, unavailableCollection])

  useEffect(() => {
    if (
      !isCollectionsSuccess ||
      isFetchingCollections ||
      isPlaceholderCollections ||
      !collectionsData ||
      collectionsPage === 0 ||
      collectionsData.items.length > 0 ||
      collectionsPage < collectionsData.totalPages
    ) {
      return
    }

    setCollectionsPage(Math.max(0, collectionsData.totalPages - 1))
  }, [
    collectionsData,
    isFetchingCollections,
    isPlaceholderCollections,
    isCollectionsSuccess,
    collectionsPage,
  ])

  const retryPath = useCallback(async () => {
    await path.refetch()
  }, [path.refetch])
  const retryCollections = useCallback(async () => {
    await collections.refetch()
  }, [collections.refetch])
  const refreshItems = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ['items', workspaceId],
      }),
    [queryClient, workspaceId]
  )
  const previousCollectionsPage = useCallback(() => {
    setCollectionsPage((current) => Math.max(0, current - 1))
  }, [])
  const nextCollectionsPage = useCallback(() => {
    setCollectionsPage((current) => current + 1)
  }, [])

  if (unavailableCollection) {
    return <LoadingState label='Voltando ao workspace…' />
  }
  if (collectionId && path.isError) {
    return (
      <div className='flex flex-col items-center gap-3 p-8'>
        <ErrorState error={path.error} onRetry={retryPath} />
        <Link
          className='border border-border bg-card px-2.5 py-1.5 text-primary transition-colors hover:border-primary/50 hover:text-foreground'
          search={{ collectionId: undefined }}
          to='/'
        >
          Voltar ao workspace
        </Link>
      </div>
    )
  }

  return (
    <main className='mx-auto flex min-h-full w-full max-w-7xl flex-col gap-7 px-6 py-10 md:px-8 md:py-12'>
      <WorkspaceBreadcrumbs
        collectionId={collectionId}
        isLoading={path.isPending}
        path={path.data ?? []}
        workspaceName={workspaceName}
      />
      <WorkspaceHeading
        collectionId={collectionId}
        isLoading={path.isPending}
        onItemCreated={refreshItems}
        path={path.data ?? []}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
      />
      <CollectionsSection
        collectionId={collectionId}
        collections={collections.data}
        error={collections.error}
        isError={collections.isError}
        isFetching={collections.isFetching}
        isPlaceholderData={collections.isPlaceholderData}
        onNextPage={nextCollectionsPage}
        onPreviousPage={previousCollectionsPage}
        onRetry={retryCollections}
        page={collectionsPage}
      />
      <ItemsSection collectionId={collectionId} workspaceId={workspaceId} />
    </main>
  )
}

function WorkspaceBreadcrumbs({
  collectionId,
  isLoading,
  path,
  workspaceName,
}: {
  collectionId: string | undefined
  isLoading: boolean
  path: CollectionPathEntry[]
  workspaceName: string
}) {
  return (
    <nav
      aria-label='breadcrumb'
      className='flex flex-wrap items-center gap-2 font-mono text-xs uppercase'
    >
      <Link
        className='border border-border bg-card px-2.5 py-1.5 text-primary transition-colors hover:border-primary/50 hover:text-foreground'
        search={{ collectionId: undefined }}
        to='/'
      >
        {workspaceName}
      </Link>
      {isLoading && collectionId ? (
        <Skeleton aria-label='Carregando caminho' className='h-4 w-32' />
      ) : null}
      {path.map((folder, index) => (
        <span className='flex items-center gap-2' key={folder.id}>
          <span aria-hidden='true' className='text-muted-foreground'>
            /
          </span>
          {index === path.length - 1 ? (
            <span aria-current='page' className='text-foreground'>
              {folder.name}
            </span>
          ) : (
            <Link
              className='text-muted-foreground transition-colors hover:text-primary'
              search={{ collectionId: folder.id }}
              to='/'
            >
              {folder.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

function WorkspaceHeading({
  collectionId,
  isLoading,
  path,
  onItemCreated,
  workspaceId,
  workspaceName,
}: {
  collectionId: string | undefined
  isLoading: boolean
  path: CollectionPathEntry[]
  workspaceName: string
  workspaceId: string
  onItemCreated: () => void
}) {
  const title = path.at(-1)?.name ?? workspaceName

  return (
    <header className='flex flex-wrap items-center justify-between gap-5 border-border border-b pb-6'>
      <div className='flex min-w-0 items-center gap-4'>
        <FolderIcon
          aria-hidden='true'
          className='size-7 shrink-0 text-primary'
        />
        <div className='min-w-0'>
          <p className='mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em]'>
            {collectionId ? 'Collection' : 'Workspace'}
          </p>
          {isLoading && collectionId ? (
            <Skeleton aria-label='Carregando pasta' className='h-8 w-48' />
          ) : (
            <h1 className='truncate font-bold font-display text-3xl uppercase tracking-tight'>
              {title}
            </h1>
          )}
        </div>
      </div>
      <CreateItemDialog
        collectionId={collectionId}
        onItemCreated={onItemCreated}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
      />
    </header>
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
  onPreviousPage,
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
  onPreviousPage: () => void
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
          <CollectionCard collection={folder} key={folder.id} />
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

function CollectionCard({
  collection,
}: {
  collection: CollectionPageResponse['items'][number]
}) {
  return (
    <Link
      className='group flex min-h-24 flex-col justify-between gap-4 border-2 border-border bg-card p-4 transition-colors hover:border-primary/50'
      search={{ collectionId: collection.id }}
      to='/'
    >
      <div className='flex min-w-0 items-center gap-2'>
        <FolderIcon
          aria-hidden='true'
          className='size-5 shrink-0 text-muted-foreground group-hover:text-primary'
        />
        <span className='truncate font-bold font-mono text-sm uppercase tracking-wide'>
          {collection.name}
        </span>
      </div>
      <span className='font-mono text-[10px] text-muted-foreground uppercase tracking-wider'>
        Pasta
      </span>
    </Link>
  )
}

function ItemsSection({
  collectionId,
  workspaceId,
}: {
  collectionId: string | undefined
  workspaceId: string
}) {
  const [itemType, setItemType] = useState<ItemTypeFilter>('all')
  const [page, setPage] = useState(0)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const items = useQuery({
    queryFn: async () =>
      (await itemsApi.list(workspaceId, collectionId, page, 100)).data,
    queryKey: ['items', workspaceId, collectionId, page],
  })
  const isInvalidPage =
    items.isSuccess &&
    !items.isFetching &&
    !items.isPlaceholderData &&
    page > 0 &&
    items.data.items.length === 0 &&
    page >= items.data.totalPages

  useEffect(() => {
    if (!(isInvalidPage && items.data)) return
    setPage(Math.max(0, items.data.totalPages - 1))
  }, [isInvalidPage, items.data])

  const changeItemType = useCallback((value: ItemTypeFilter) => {
    setItemType(value)
    setPage(0)
  }, [])
  const changeSortOrder = useCallback((value: 'asc' | 'desc') => {
    setSortOrder(value)
  }, [])
  const previousPage = useCallback(() => setPage((current) => current - 1), [])
  const nextPage = useCallback(() => setPage((current) => current + 1), [])
  const copyTitle = useCallback(async (title: string) => {
    try {
      await navigator.clipboard.writeText(title)
      toast.success('Título copiado.')
    } catch {
      toast.error('Não foi possível copiar o título.')
    }
  }, [])
  const visibleItems = (items.data?.items ?? [])
    .filter((item) => itemType === 'all' || item.type === itemType)
    .toSorted((left, right) =>
      sortOrder === 'asc'
        ? left.title.localeCompare(right.title, 'pt-BR')
        : right.title.localeCompare(left.title, 'pt-BR')
    )

  return (
    <section aria-labelledby='items-heading' className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2
          className='font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest'
          id='items-heading'
        >
          Itens
        </h2>
        <ItemControls
          itemType={itemType}
          onItemTypeChange={changeItemType}
          onSortOrderChange={changeSortOrder}
          sortOrder={sortOrder}
        />
      </div>
      <ItemsContent
        error={items.error}
        isError={items.isError}
        isFetching={items.isFetching}
        isInvalidPage={isInvalidPage}
        isPending={items.isPending}
        items={items.data}
        onCopyTitle={copyTitle}
        onNextPage={nextPage}
        onPreviousPage={previousPage}
        page={page}
        typeFilter={itemType}
        visibleItems={visibleItems}
      />
    </section>
  )
}

function ItemControls({
  itemType,
  onItemTypeChange,
  onSortOrderChange,
  sortOrder,
}: {
  itemType: ItemTypeFilter
  onItemTypeChange: (value: ItemTypeFilter) => void
  onSortOrderChange: (value: 'asc' | 'desc') => void
  sortOrder: 'asc' | 'desc'
}) {
  const handleItemTypeChange = useCallback(
    (value: string) => onItemTypeChange(value as ItemTypeFilter),
    [onItemTypeChange]
  )
  const handleSortOrderChange = useCallback(
    (value: string) => onSortOrderChange(value as 'asc' | 'desc'),
    [onSortOrderChange]
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Select onValueChange={handleItemTypeChange} value={itemType}>
        <SelectTrigger aria-label='Filtrar itens por tipo' className='w-40'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>Todos os tipos</SelectItem>
          <SelectItem value='text'>Texto</SelectItem>
          <SelectItem value='link'>Link</SelectItem>
          <SelectItem value='secret'>Segredo</SelectItem>
        </SelectContent>
      </Select>
      <Select onValueChange={handleSortOrderChange} value={sortOrder}>
        <SelectTrigger aria-label='Ordenar itens por título' className='w-36'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='asc'>Título A–Z</SelectItem>
          <SelectItem value='desc'>Título Z–A</SelectItem>
        </SelectContent>
      </Select>
      <Button
        aria-describedby='archive-filter-note'
        disabled
        size='sm'
        title='O backend ainda lista apenas itens ativos.'
        variant='outline'
      >
        <ArchiveIcon aria-hidden='true' />
        Mostrar arquivados
      </Button>
      <span className='sr-only' id='archive-filter-note'>
        O backend ainda não disponibiliza a listagem de itens arquivados.
      </span>
    </div>
  )
}

function ItemsContent({
  error,
  isError,
  isFetching,
  isInvalidPage,
  isPending,
  items,
  onCopyTitle,
  onNextPage,
  onPreviousPage,
  page,
  typeFilter,
  visibleItems,
}: {
  error: Error | null
  isError: boolean
  isFetching: boolean
  isInvalidPage: boolean
  isPending: boolean
  items: ItemPageResponse | undefined
  onCopyTitle: (title: string) => void
  onNextPage: () => void
  onPreviousPage: () => void
  page: number
  typeFilter: ItemTypeFilter
  visibleItems: ItemResponse[]
}) {
  if (isError) return <ErrorState error={error} />
  if (isInvalidPage) return <LoadingState label='Carregando itens…' />
  if (isPending) return <LoadingState label='Carregando itens…' />
  if (visibleItems.length === 0) {
    return (
      <EmptyItemsContent
        isFetching={isFetching}
        items={items}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        page={page}
        typeFilter={typeFilter}
      />
    )
  }

  return (
    <>
      <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4'>
        {visibleItems.map((item) => (
          <ItemListCard item={item} key={item.id} onCopyTitle={onCopyTitle} />
        ))}
      </div>
      {items && items.totalPages > 1 ? (
        <PaginationControls
          isFetching={isFetching}
          onNext={onNextPage}
          onPrevious={onPreviousPage}
          page={page}
          totalPages={items.totalPages}
        />
      ) : null}
    </>
  )
}

function EmptyItemsContent({
  isFetching,
  items,
  onNextPage,
  onPreviousPage,
  page,
  typeFilter,
}: {
  isFetching: boolean
  items: ItemPageResponse | undefined
  onNextPage: () => void
  onPreviousPage: () => void
  page: number
  typeFilter: ItemTypeFilter
}) {
  const hasOtherPages = Boolean(items && items.totalPages > 1)
  const isEmptyCollection = typeFilter === 'all' && page === 0 && !hasOtherPages
  const description = isEmptyCollection
    ? 'Esta pasta ainda não tem itens.'
    : hasOtherPages
      ? 'Nenhum item encontrado nesta página. Use a paginação para consultar outras páginas.'
      : typeFilter === 'all'
        ? 'Nenhum item encontrado nesta página.'
        : 'Nenhum item deste tipo foi encontrado nesta página.'
  const shouldShowPagination =
    Boolean(items && items.totalPages > 1) || page > 0

  return (
    <>
      <EmptyState
        description={description}
        icon={<FileIcon aria-hidden='true' className='size-6' />}
        title='Nenhum item encontrado'
        variant='compact'
      />
      {items && shouldShowPagination ? (
        <PaginationControls
          isFetching={isFetching}
          onNext={onNextPage}
          onPrevious={onPreviousPage}
          page={page}
          totalPages={items.totalPages}
        />
      ) : null}
    </>
  )
}

function ItemListCard({
  item,
  onCopyTitle,
}: {
  item: ItemResponse
  onCopyTitle: (title: string) => void
}) {
  const handleCopyTitle = useCallback(
    () => onCopyTitle(item.title),
    [item.title, onCopyTitle]
  )
  const Icon =
    item.type === 'secret'
      ? KeyIcon
      : item.type === 'link'
        ? LinkIcon
        : FileIcon
  const preview = item.type === 'secret' ? '••••••••••••' : item.preview

  return (
    <article className='flex min-h-21 cursor-default flex-col justify-between gap-3 border-2 border-border bg-card p-4 transition-all hover:border-primary/50'>
      <div className='flex w-full items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          {item.type === 'text' ? (
            <span
              aria-hidden='true'
              className='shrink-0 font-mono text-lg text-muted-foreground leading-none'
            >
              ¶
            </span>
          ) : (
            <Icon
              aria-hidden='true'
              className={`size-4 shrink-0 ${item.type === 'secret' ? 'text-amber-500' : 'text-muted-foreground'}`}
            />
          )}
          <h3 className='truncate font-bold font-mono text-sm tracking-wide'>
            {item.title}
          </h3>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          <span
            className={`px-1.5 py-0.5 font-mono font-semibold text-[10px] uppercase ${item.type === 'secret' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}
          >
            {item.type}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Ações de ${item.title}`}
                className='text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground'
                type='button'
              >
                <DotsThreeVerticalIcon aria-hidden='true' className='size-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onSelect={handleCopyTitle}>
                Copiar título
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {preview ? (
        <p className='truncate font-mono text-muted-foreground text-xs'>
          {preview}
        </p>
      ) : null}
    </article>
  )
}

function PaginationControls({
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
