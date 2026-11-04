import {
  FileIcon,
  FileSearchIcon,
  ImageIcon,
  KeyIcon,
  LinkIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { collectionsApi, itemsApi } from '@/api/endpoints'
import { itemKeys } from '@/api/item-keys'
import type { ItemResponse, ItemType } from '@/api/types'
import { EditItemDialog } from '@/components/edit-item-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'

const PAGE_SIZE = 20
const typeLabels: Record<ItemType, string> = {
  file: 'Arquivo',
  image: 'Imagem',
  link: 'Link',
  secret: 'Segredo',
  text: 'Texto',
}
const typeIcons = {
  file: FileIcon,
  image: ImageIcon,
  link: LinkIcon,
  secret: KeyIcon,
  text: FileIcon,
} satisfies Record<ItemType, typeof FileIcon>

export function GlobalItemSearch() {
  const workspace = useCurrentWorkspace()
  const workspaceId = workspace.data?.id
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedItemId, setSelectedItemId] = useState<string>()
  const query = term.trim()
  const results = useQuery({
    enabled: Boolean(open && workspaceId && query),
    queryFn: async ({ signal }) => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (
        await itemsApi.search(
          workspaceId,
          { includeArchived, page, q: query, size: PAGE_SIZE },
          signal
        )
      ).data
    },
    queryKey: workspaceId
      ? itemKeys.search(workspaceId, {
          includeArchived,
          page,
          q: query,
          size: PAGE_SIZE,
        })
      : ['items', 'search-disabled'],
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const searchScopeKey = [
    query,
    includeArchived,
    page,
    results.dataUpdatedAt,
  ] as const

  const openSearch = useCallback(() => setOpen(true), [])
  const closeSelectedItem = useCallback(() => setSelectedItemId(undefined), [])
  const handleTermChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTerm(event.target.value.slice(0, 255))
      setPage(0)
    },
    []
  )
  const handleArchivedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      setIncludeArchived(checked === true)
      setPage(0)
    },
    []
  )
  const onNext = useCallback(() => setPage((current) => current + 1), [])
  const onPrevious = useCallback(
    () => setPage((current) => Math.max(0, current - 1)),
    []
  )
  const onOpenItem = useCallback((item: ItemResponse) => {
    setSelectedItemId(item.id)
    setOpen(false)
  }, [])
  const onRetry = useCallback(() => results.refetch(), [results.refetch])

  return (
    <>
      <Button
        aria-label='Buscar itens no workspace'
        onClick={openSearch}
        size='icon'
        variant='ghost'
      >
        <FileSearchIcon aria-hidden='true' size={18} />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Buscar itens</DialogTitle>
            <DialogDescription>
              Pesquise títulos em todo o workspace.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <label
              className='block space-y-1.5 font-mono text-xs'
              htmlFor='global-item-search'
            >
              <span>Nome do item</span>
              <Input
                autoComplete='off'
                id='global-item-search'
                maxLength={255}
                onChange={handleTermChange}
                placeholder='Ex.: chave produção'
                type='search'
                value={term}
              />
            </label>
            <label
              className='flex min-h-11 items-center gap-2 font-mono text-xs'
              htmlFor='include-archived-items'
            >
              <Checkbox
                checked={includeArchived}
                id='include-archived-items'
                onCheckedChange={handleArchivedChange}
              />
              Incluir itens arquivados
            </label>
            {query && open ? (
              <SearchResults
                error={results.isError}
                fetching={results.isFetching}
                items={results.data?.items}
                onNext={onNext}
                onOpenItem={onOpenItem}
                onPrevious={onPrevious}
                onRetry={onRetry}
                page={page}
                searchScopeKey={searchScopeKey}
                totalItems={results.data?.totalItems ?? 0}
                totalPages={results.data?.totalPages ?? 0}
                workspaceId={workspaceId}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      {selectedItemId && workspaceId ? (
        <EditItemDialog
          itemId={selectedItemId}
          onClose={closeSelectedItem}
          readOnly
          showAttachmentPreview
          unavailableOnAccessError
          workspaceId={workspaceId}
        />
      ) : null}
    </>
  )
}

function SearchResults({
  error,
  fetching,
  items,
  onNext,
  onOpenItem,
  onPrevious,
  onRetry,
  page,
  searchScopeKey,
  totalItems,
  totalPages,
  workspaceId,
}: {
  error: boolean
  fetching: boolean
  items: ItemResponse[] | undefined
  onNext: () => void
  onOpenItem: (item: ItemResponse) => void
  onPrevious: () => void
  onRetry: () => void
  page: number
  searchScopeKey: readonly (string | boolean | number)[]
  totalItems: number
  totalPages: number
  workspaceId: string | undefined
}) {
  const empty = !items || items.length === 0
  const announcement =
    fetching || error
      ? ''
      : empty
        ? 'Nenhum item encontrado'
        : `${totalItems} ${totalItems === 1 ? 'resultado encontrado' : 'resultados encontrados'}`

  return (
    <>
      <p
        aria-live='polite'
        className={
          empty && !fetching && !error
            ? 'py-4 text-center text-muted-foreground text-sm'
            : 'sr-only'
        }
        role='status'
      >
        {announcement}
      </p>
      {fetching ? <LoadingState label='Buscando itens…' /> : null}
      {error && !fetching ? (
        <div className='space-y-2' role='alert'>
          <p className='text-destructive text-sm'>
            Não foi possível pesquisar itens.
          </p>
          <Button onClick={onRetry} size='sm' variant='outline'>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {fetching || error || empty ? null : (
        <div className='space-y-3'>
          <ul
            aria-label='Resultados da busca'
            className='divide-y divide-border border-border border-y'
          >
            {items.map((item) => (
              <SearchResult
                item={item}
                key={item.id}
                onOpenItem={onOpenItem}
                searchScopeKey={searchScopeKey}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
          {totalPages > 1 ? (
            <div className='flex items-center justify-between gap-2'>
              <span className='font-mono text-muted-foreground text-xs'>
                Página {page + 1} de {totalPages}
              </span>
              <div className='flex gap-2'>
                <Button
                  disabled={page === 0 || fetching}
                  onClick={onPrevious}
                  size='sm'
                  variant='outline'
                >
                  Anterior
                </Button>
                <Button
                  disabled={page + 1 >= totalPages || fetching}
                  onClick={onNext}
                  size='sm'
                  variant='outline'
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

function SearchResult({
  item,
  onOpenItem,
  searchScopeKey,
  workspaceId,
}: {
  item: ItemResponse
  onOpenItem: (item: ItemResponse) => void
  searchScopeKey: readonly (string | boolean | number)[]
  workspaceId: string | undefined
}) {
  const path = useQuery({
    enabled: Boolean(workspaceId && item.collectionId),
    gcTime: 0,
    queryFn: async () => {
      if (!(workspaceId && item.collectionId)) return []
      return (await collectionsApi.path(workspaceId, item.collectionId)).data
    },
    queryKey: [
      'search-item-collection-path',
      workspaceId,
      item.collectionId,
      item.id,
      ...searchScopeKey,
    ],
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const Icon = typeIcons[item.type]
  const handleOpen = useCallback(() => onOpenItem(item), [item, onOpenItem])
  return (
    <li>
      <button
        className='flex min-h-14 w-full items-center gap-3 px-2 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'
        onClick={handleOpen}
        type='button'
      >
        <Icon
          aria-hidden='true'
          className='size-4 shrink-0 text-muted-foreground'
        />
        <span className='min-w-0 flex-1'>
          <span className='block truncate font-mono font-semibold text-sm'>
            {item.title}
          </span>
          {path.isSuccess && !path.isFetching && path.data.length > 0 ? (
            <span className='block truncate text-muted-foreground text-xs'>
              {path.data.map((entry) => entry.name).join(' / ')}
            </span>
          ) : null}
        </span>
        <span className='flex shrink-0 items-center gap-1.5'>
          {item.archivedAt ? <Badge variant='outline'>Arquivado</Badge> : null}
          <Badge variant='secondary'>{typeLabels[item.type]}</Badge>
        </span>
      </button>
    </li>
  )
}
