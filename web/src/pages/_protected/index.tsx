import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { EllipsisVertical, File, Folder, History, Settings } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { isUnavailableCollectionError } from '@/api/collection-errors'
import { itemsApi } from '@/api/endpoints'
import { itemKeys } from '@/api/item-keys'
import type {
  CollectionPathEntry,
  ItemPageResponse,
  ItemResponse,
} from '@/api/types'
import { CreateItemDialog } from '@/components/items/create-item-dialog'
import { EditItemDialog } from '@/components/items/edit-item-dialog'
import {
  InlineCodeContent,
  InlineCodeRoot,
  InlineCodeSeparator,
  InlineCodeText,
} from '@/components/items/inline-code'
import type { CopyKind } from '@/components/items/item-actions'
import { ItemListCard } from '@/components/items/item-list-card'
import { NotFoundPage } from '@/components/layout/not-found-page'
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
import { CreateCollectionButton } from '@/components/workspace/collection-management'
import { ReceivedContentTree } from '@/components/workspace/received-content-tree'
import {
  PaginationControls,
  WorkspaceCollections,
} from '@/components/workspace/workspace-collections'
import { useCollectionPath } from '@/hooks/use-collection-path'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

const searchSchema = z.object({
  archived: z.boolean().optional().catch(undefined),
  collectionId: z.guid().optional().catch(undefined),
  itemId: z.guid().optional().catch(undefined),
})
const itemTypeOptions = [
  'all',
  'text',
  'link',
  'secret',
  'file',
  'image',
] as const
type ItemTypeFilter = (typeof itemTypeOptions)[number]

export const Route = createFileRoute('/_protected/')({
  component: HomePage,
  head: () => ({ meta: [{ title: 'Vaulty' }] }),
  notFoundComponent: NotFoundPage,
  validateSearch: searchSchema,
})

function HomePage() {
  const { archived, collectionId, itemId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const changeArchived = useCallback(
    (value: boolean) =>
      navigate({
        search: (prev) => ({ ...prev, archived: value || undefined }),
      }),
    [navigate]
  )
  const workspaces = useCurrentWorkspace()
  const workspace = workspaces.data
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
      <main className='container mx-auto px-4 py-8 md:px-8 md:py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar os itens.'
          title='Nenhum workspace disponível'
        />
      </main>
    )
  }

  return (
    <WorkspaceBrowser
      archived={Boolean(archived)}
      collectionId={collectionId}
      itemId={itemId}
      // Remounting per folder prevents folder-scoped state and data from leaking.
      key={`${workspace.id}:${collectionId ?? 'root'}`}
      onArchivedChange={changeArchived}
      workspaceId={workspace.id}
      workspaceName={workspace.name ?? 'Workspace'}
    />
  )
}

function WorkspaceBrowser({
  archived,
  collectionId,
  itemId,
  onArchivedChange,
  workspaceId,
  workspaceName,
}: {
  archived: boolean
  collectionId: string | undefined
  itemId: string | undefined
  onArchivedChange: (archived: boolean) => void
  workspaceId: string
  workspaceName: string
}) {
  const navigate = Route.useNavigate()
  const closeItem = useCallback(
    () => navigate({ search: (prev) => ({ ...prev, itemId: undefined }) }),
    [navigate]
  )
  const queryClient = useQueryClient()
  const permissions = useWorkspacePermissions(workspaceId)
  const path = useCollectionPath(workspaceId, collectionId)
  const [createCollectionSignal, setCreateCollectionSignal] = useState(false)
  const openCreateCollection = useCallback(
    () => setCreateCollectionSignal(true),
    []
  )
  const clearCreateCollectionSignal = useCallback(
    () => setCreateCollectionSignal(false),
    []
  )
  const pathUnavailable = isUnavailableCollectionError(path.error, 'path')

  const retryPath = useCallback(async () => {
    await path.refetch()
  }, [path.refetch])
  const refreshItems = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(workspaceId),
      }),
    [queryClient, workspaceId]
  )
  const retryPermissions = useCallback(async () => {
    await permissions.refetch()
  }, [permissions.refetch])
  if (permissions.isPending)
    return <LoadingState label='Carregando permissões…' />
  if (permissions.isError) {
    return <ErrorState error={permissions.error} onRetry={retryPermissions} />
  }
  if (collectionId && path.isError && !pathUnavailable) {
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
    <main className='container mx-auto flex min-h-full flex-col gap-7 px-4 py-8 md:px-8 md:py-12'>
      <WorkspaceBreadcrumbs
        collectionId={collectionId}
        isLoading={path.isPending}
        path={path.data ?? []}
      />
      <WorkspaceHeading
        canCreateCollection={permissions.can('collection', 'create')}
        canCreateItem={permissions.can('item', 'create')}
        canReadActivity={permissions.can('activity', 'read')}
        collectionId={collectionId}
        isLoading={path.isPending}
        onCreateCollection={openCreateCollection}
        onItemCreated={refreshItems}
        path={path.data ?? []}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
      />
      <WorkspaceCollections
        canCreateCollection={permissions.can('collection', 'create')}
        collectionId={collectionId}
        createCollectionSignal={createCollectionSignal}
        onCollectionDialogOpened={clearCreateCollectionSignal}
        pathUnavailable={pathUnavailable}
        workspaceId={workspaceId}
      />
      {!collectionId && permissions.can('item', 'read') ? (
        <ReceivedContentTree workspaceId={workspaceId} />
      ) : null}
      {permissions.can('item', 'read') ? (
        <ItemsSection
          archived={archived}
          collectionId={collectionId}
          onArchivedChange={onArchivedChange}
          workspaceId={workspaceId}
        />
      ) : null}
      {itemId ? (
        <EditItemDialog
          itemId={itemId}
          key={itemId}
          onClose={closeItem}
          readOnly
          showAttachmentPreview
          unavailableOnAccessError
          workspaceId={workspaceId}
        />
      ) : null}
    </main>
  )
}

function WorkspaceBreadcrumbs({
  collectionId,
  isLoading,
  path,
}: {
  collectionId: string | undefined
  isLoading: boolean
  path: CollectionPathEntry[]
}) {
  if (!collectionId) return null
  const truncate = path.length > 3
  const visiblePath = truncate ? [path[0], null, ...path.slice(-2)] : path

  return (
    <InlineCodeRoot>
      <InlineCodeContent aria-label='Caminho da pasta' role='navigation'>
        <Link className='group' search={{ collectionId: undefined }} to='/'>
          <InlineCodeText className='text-primary transition-colors group-hover:text-foreground'>
            Início
          </InlineCodeText>
        </Link>
        {isLoading ? (
          <Skeleton aria-label='Carregando caminho' className='h-4 w-32' />
        ) : null}
        {visiblePath.map((folder, index) => {
          if (folder === null) {
            return (
              <span className='flex items-center' key='ellipsis'>
                <InlineCodeSeparator />
                <InlineCodeText>...</InlineCodeText>
              </span>
            )
          }

          const originalIndex = truncate
            ? index === 0
              ? 0
              : path.length + index - 4
            : index
          const isLast = originalIndex === path.length - 1

          return (
            <span className='flex items-center' key={folder.id}>
              <InlineCodeSeparator />
              {isLast ? (
                <InlineCodeText className='max-w-[16ch] truncate text-primary'>
                  {folder.name}
                </InlineCodeText>
              ) : (
                <Link
                  className='group'
                  search={{ collectionId: folder.id }}
                  to='/'
                >
                  <InlineCodeText className='max-w-[16ch] truncate transition-colors group-hover:text-foreground'>
                    {folder.name}
                  </InlineCodeText>
                </Link>
              )}
            </span>
          )
        })}
      </InlineCodeContent>
    </InlineCodeRoot>
  )
}

function WorkspaceHeading({
  collectionId,
  isLoading,
  onCreateCollection,
  path,
  onItemCreated,
  workspaceId,
  workspaceName,
  canCreateCollection,
  canCreateItem,
  canReadActivity,
}: {
  collectionId: string | undefined
  isLoading: boolean
  onCreateCollection: () => void
  path: CollectionPathEntry[]
  workspaceName: string
  workspaceId: string
  onItemCreated: () => void
  canCreateCollection: boolean
  canCreateItem: boolean
  canReadActivity: boolean
}) {
  const title = path.at(-1)?.name ?? workspaceName

  return (
    <header className='flex flex-wrap items-center justify-between gap-5 border-border border-b pb-6'>
      <div className='flex min-w-0 items-center gap-4'>
        <Folder aria-hidden='true' className='size-7 shrink-0 text-primary' />
        <div className='min-w-0'>
          <p className='mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em]'>
            {collectionId ? 'Collection' : 'Workspace'}
          </p>
          {isLoading && collectionId ? (
            <Skeleton aria-label='Carregando pasta' className='h-8 w-48' />
          ) : (
            <div className='flex min-w-0 items-center gap-2'>
              <h1 className='truncate font-bold font-display text-3xl uppercase tracking-tight'>
                {title}
              </h1>
              {collectionId ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label='Ações do workspace'
                      className='flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground/80 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-accent-foreground'
                      type='button'
                    >
                      <EllipsisVertical aria-hidden='true' className='size-6' />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='start'>
                    {canReadActivity ? (
                      <DropdownMenuItem asChild>
                        <Link
                          className='flex w-full items-center gap-2'
                          to='/atividades'
                        >
                          <History aria-hidden='true' size={14} />
                          Histórico de atividades
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link
                        className='flex w-full items-center gap-2'
                        to='/configuracoes/geral'
                      >
                        <Settings aria-hidden='true' size={14} />
                        Configurações do workspace
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {canCreateCollection ? (
          <CreateCollectionButton onClick={onCreateCollection} />
        ) : null}
        {canCreateItem ? (
          <CreateItemDialog
            collectionId={collectionId}
            onItemCreated={onItemCreated}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
          />
        ) : null}
      </div>
    </header>
  )
}

const copyMessages = {
  content: {
    error: 'Não foi possível copiar o conteúdo.',
    success: 'Conteúdo copiado.',
  },
  title: {
    error: 'Não foi possível copiar o título.',
    success: 'Título copiado.',
  },
} as const

function ItemsSection({
  archived,
  collectionId,
  onArchivedChange,
  workspaceId,
}: {
  archived: boolean
  collectionId: string | undefined
  onArchivedChange: (archived: boolean) => void
  workspaceId: string
}) {
  const [itemType, setItemType] = useState<ItemTypeFilter>('all')
  const [page, setPage] = useState(0)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const items = useQuery({
    queryFn: async () =>
      (await itemsApi.list(workspaceId, collectionId, page, 100, { archived }))
        .data,
    queryKey: itemKeys.list(workspaceId, { archived, collectionId, page }),
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
  const changeArchived = useCallback(
    (value: boolean) => {
      setItemType('all')
      setPage(0)
      onArchivedChange(value)
    },
    [onArchivedChange]
  )
  const changeSortOrder = useCallback((value: 'asc' | 'desc') => {
    setSortOrder(value)
  }, [])
  const previousPage = useCallback(() => setPage((current) => current - 1), [])
  const nextPage = useCallback(() => setPage((current) => current + 1), [])
  const copyText = useCallback(async (text: string, kind: CopyKind) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(copyMessages[kind].success)
    } catch {
      toast.error(copyMessages[kind].error)
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
      <div className='flex flex-col items-start gap-3'>
        <h2
          className='font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest'
          id='items-heading'
        >
          Itens
        </h2>
        <ItemControls
          archived={archived}
          itemType={itemType}
          onArchivedChange={changeArchived}
          onItemTypeChange={changeItemType}
          onSortOrderChange={changeSortOrder}
          sortOrder={sortOrder}
        />
      </div>
      <ItemsContent
        archived={archived}
        error={items.error}
        isError={items.isError}
        isFetching={items.isFetching}
        isInvalidPage={isInvalidPage}
        isPending={items.isPending}
        items={items.data}
        onCopy={copyText}
        onNextPage={nextPage}
        onPreviousPage={previousPage}
        page={page}
        typeFilter={itemType}
        visibleItems={visibleItems}
        workspaceId={workspaceId}
      />
    </section>
  )
}

function ItemControls({
  archived,
  itemType,
  onArchivedChange,
  onItemTypeChange,
  onSortOrderChange,
  sortOrder,
}: {
  archived: boolean
  itemType: ItemTypeFilter
  onArchivedChange: (archived: boolean) => void
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
      <ArchiveTabs archived={archived} onChange={onArchivedChange} />
      <Select onValueChange={handleItemTypeChange} value={itemType}>
        <SelectTrigger aria-label='Filtrar itens por tipo' className='w-40'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>Todos os tipos</SelectItem>
          <SelectItem value='text'>Texto</SelectItem>
          <SelectItem value='link'>Link</SelectItem>
          <SelectItem value='secret'>Segredo</SelectItem>
          <SelectItem value='file'>Arquivo</SelectItem>
          <SelectItem value='image'>Imagem</SelectItem>
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
    </div>
  )
}

const archiveToggleClass =
  'inline-flex cursor-pointer items-center justify-center rounded-sm px-3 py-1.5 font-mono text-muted-foreground text-xs uppercase outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm dark:aria-pressed:bg-accent'

function ArchiveTabs({
  archived,
  onChange,
}: {
  archived: boolean
  onChange: (archived: boolean) => void
}) {
  const showActive = useCallback(() => onChange(false), [onChange])
  const showArchived = useCallback(() => onChange(true), [onChange])
  return (
    <fieldset
      aria-label='Estado dos itens'
      className='inline-flex h-9 items-center gap-1 rounded-sm bg-muted p-1'
    >
      <button
        aria-pressed={!archived}
        className={archiveToggleClass}
        onClick={showActive}
        type='button'
      >
        Ativos
      </button>
      <button
        aria-pressed={archived}
        className={archiveToggleClass}
        onClick={showArchived}
        type='button'
      >
        Arquivados
      </button>
    </fieldset>
  )
}

function ItemsContent({
  archived,
  error,
  isError,
  isFetching,
  isInvalidPage,
  isPending,
  items,
  onCopy,
  onNextPage,
  onPreviousPage,
  page,
  typeFilter,
  visibleItems,
  workspaceId,
}: {
  archived: boolean
  error: Error | null
  isError: boolean
  isFetching: boolean
  isInvalidPage: boolean
  isPending: boolean
  items: ItemPageResponse | undefined
  onCopy: (text: string, kind: CopyKind) => void
  onNextPage: () => void
  onPreviousPage: () => void
  page: number
  typeFilter: ItemTypeFilter
  visibleItems: ItemResponse[]
  workspaceId: string
}) {
  if (isError) return <ErrorState error={error} />
  if (isInvalidPage) return <LoadingState label='Carregando itens…' />
  if (isPending) return <LoadingState label='Carregando itens…' />
  if (visibleItems.length === 0) {
    return (
      <EmptyItemsContent
        archived={archived}
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
          <ItemListCard
            item={item}
            key={item.id}
            onCopy={onCopy}
            workspaceId={workspaceId}
          />
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

function getEmptyItemsCopy({
  archived,
  hasOtherPages,
  isEmptyCollection,
  typeFilter,
}: {
  archived: boolean
  hasOtherPages: boolean
  isEmptyCollection: boolean
  typeFilter: ItemTypeFilter
}) {
  if (isEmptyCollection) {
    return archived
      ? {
          description: 'Itens arquivados aparecerão aqui.',
          title: 'Nenhum item arquivado',
        }
      : {
          description: 'Esta pasta ainda não tem itens.',
          title: 'Nenhum item encontrado',
        }
  }
  let description = 'Nenhum item encontrado nesta página.'
  if (hasOtherPages) {
    description =
      'Nenhum item encontrado nesta página. Use a paginação para consultar outras páginas.'
  } else if (typeFilter !== 'all') {
    description = 'Nenhum item deste tipo foi encontrado nesta página.'
  }
  return { description, title: 'Nenhum item encontrado' }
}

function EmptyItemsContent({
  archived,
  isFetching,
  items,
  onNextPage,
  onPreviousPage,
  page,
  typeFilter,
}: {
  archived: boolean
  isFetching: boolean
  items: ItemPageResponse | undefined
  onNextPage: () => void
  onPreviousPage: () => void
  page: number
  typeFilter: ItemTypeFilter
}) {
  const hasOtherPages = Boolean(items && items.totalPages > 1)
  const isEmptyCollection = typeFilter === 'all' && page === 0 && !hasOtherPages
  const copy = getEmptyItemsCopy({
    archived,
    hasOtherPages,
    isEmptyCollection,
    typeFilter,
  })
  const shouldShowPagination =
    Boolean(items && items.totalPages > 1) || page > 0

  return (
    <>
      <EmptyState
        description={copy.description}
        icon={<File aria-hidden='true' className='size-6' />}
        title={copy.title}
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
