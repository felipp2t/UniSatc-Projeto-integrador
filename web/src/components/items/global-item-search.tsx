import { useQuery } from '@tanstack/react-query'
import { FileSearch } from 'lucide-react'
import { useCallback, useState } from 'react'
import { collectionsApi, itemsApi, receivedContentApi } from '@/api/endpoints'
import type { ItemResponse, ItemType, ReceivedItemResponse } from '@/api/types'
import { receivedContentKeys } from '@/api/workspace-keys'
import { EditItemDialog } from '@/components/items/edit-item-dialog'
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
import { ReceivedItemDialog } from '@/components/workspace/received-item-dialog'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'

const PAGE_SIZE = 20
const contentTypeLabels = {
  file: 'Arquivo',
  image: 'Imagem',
  link: 'Link',
  secret: 'Segredo',
  text: 'Texto',
} as const
const typeLabel = (type: ItemType) =>
  type === 'folder' ? 'Pasta' : contentTypeLabels[type]

export function GlobalItemSearch() {
  const workspace = useCurrentWorkspace()
  const workspaceId = workspace.data?.id
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(0)
  const [receivedPage, setReceivedPage] = useState(0)
  const [selectedItemId, setSelectedItemId] = useState<string>()
  const [selectedReceivedId, setSelectedReceivedId] = useState<string>()
  const query = term.trim()
  const items = useQuery({
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
    queryKey: ['item-search', workspaceId, query, page, includeArchived],
  })
  const received = useQuery({
    enabled: Boolean(open && workspaceId && query),
    queryFn: async ({ signal }) => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (
        await receivedContentApi.list(
          workspaceId,
          { contentOnly: true, page: receivedPage, q: query, size: PAGE_SIZE },
          signal
        )
      ).data
    },
    queryKey: receivedContentKeys.list(workspaceId, {
      contentOnly: true,
      page: receivedPage,
      q: query,
      size: PAGE_SIZE,
    }),
  })
  const onRetry = useCallback(
    () => Promise.all([items.refetch(), received.refetch()]),
    [items.refetch, received.refetch]
  )
  const openItem = useCallback((item: ItemResponse) => {
    setSelectedItemId(item.id)
    setOpen(false)
  }, [])
  const openReceived = useCallback((item: ReceivedItemResponse) => {
    setSelectedReceivedId(item.id)
    setOpen(false)
  }, [])
  const closeItem = useCallback(() => setSelectedItemId(undefined), [])
  const closeReceived = useCallback(() => setSelectedReceivedId(undefined), [])
  const changeTerm = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTerm(event.target.value.slice(0, 255))
      setPage(0)
      setReceivedPage(0)
    },
    []
  )
  const openSearch = useCallback(() => setOpen(true), [])
  const changeArchived = useCallback((checked: boolean | 'indeterminate') => {
    setIncludeArchived(checked === true)
    setPage(0)
    setReceivedPage(0)
  }, [])
  const nextPage = useCallback(() => setPage((current) => current + 1), [])
  const previousPage = useCallback(
    () => setPage((current) => Math.max(0, current - 1)),
    []
  )
  const nextReceivedPage = useCallback(
    () => setReceivedPage((current) => current + 1),
    []
  )
  const previousReceivedPage = useCallback(
    () => setReceivedPage((current) => Math.max(0, current - 1)),
    []
  )

  return (
    <>
      <Button
        aria-label='Buscar itens no workspace'
        onClick={openSearch}
        size='icon'
        variant='ghost'
      >
        <FileSearch aria-hidden='true' size={18} />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Buscar itens</DialogTitle>
            <DialogDescription>
              Pesquise títulos nas coleções e nos compartilhamentos recebidos.
            </DialogDescription>
          </DialogHeader>
          <label
            className='block space-y-1.5 text-xs'
            htmlFor='global-item-search'
          >
            <span>Nome do item</span>
            <Input
              autoComplete='off'
              id='global-item-search'
              maxLength={255}
              onChange={changeTerm}
              placeholder='Ex.: chave produção'
              type='search'
              value={term}
            />
          </label>
          <label
            className='flex min-h-11 items-center gap-2 text-xs'
            htmlFor='include-archived-items'
          >
            <Checkbox
              checked={includeArchived}
              id='include-archived-items'
              onCheckedChange={changeArchived}
            />
            Incluir itens arquivados
          </label>
          {query && open ? (
            <SearchResults
              error={items.isError || received.isError}
              fetching={items.isFetching || received.isFetching}
              itemPage={page}
              items={items.data?.items}
              itemTotalItems={items.data?.totalItems ?? 0}
              itemTotalPages={items.data?.totalPages ?? 0}
              onNext={nextPage}
              onNextReceived={nextReceivedPage}
              onOpenItem={openItem}
              onOpenReceived={openReceived}
              onPrevious={previousPage}
              onPreviousReceived={previousReceivedPage}
              onRetry={onRetry}
              receivedItems={
                received.data?.items.filter((item) => item.type !== 'folder') ??
                []
              }
              receivedPage={receivedPage}
              receivedTotalItems={received.data?.totalItems ?? 0}
              receivedTotalPages={received.data?.totalPages ?? 0}
              workspaceId={workspaceId ?? ''}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {selectedItemId && workspaceId ? (
        <EditItemDialog
          itemId={selectedItemId}
          onClose={closeItem}
          readOnly
          showAttachmentPreview
          unavailableOnAccessError
          workspaceId={workspaceId}
        />
      ) : null}
      {selectedReceivedId && workspaceId ? (
        <ReceivedItemDialog
          itemId={selectedReceivedId}
          onClose={closeReceived}
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
  itemPage,
  itemTotalItems,
  itemTotalPages,
  onNext,
  onNextReceived,
  onOpenItem,
  onOpenReceived,
  onPrevious,
  onPreviousReceived,
  onRetry,
  receivedPage,
  receivedItems,
  receivedTotalItems,
  receivedTotalPages,
  workspaceId,
}: {
  error: boolean
  fetching: boolean
  items: ItemResponse[] | undefined
  itemPage: number
  itemTotalItems: number
  itemTotalPages: number
  onNext: () => void
  onNextReceived: () => void
  onOpenItem: (item: ItemResponse) => void
  onOpenReceived: (item: ReceivedItemResponse) => void
  onPrevious: () => void
  onPreviousReceived: () => void
  onRetry: () => void
  receivedPage: number
  receivedItems: ReceivedItemResponse[]
  receivedTotalItems: number
  receivedTotalPages: number
  workspaceId: string
}) {
  if (fetching) return <LoadingState label='Buscando itens…' />
  if (error) {
    return (
      <div className='space-y-2' role='alert'>
        <p className='text-destructive text-sm'>
          Não foi possível pesquisar itens.
        </p>
        <Button onClick={onRetry} size='sm' variant='outline'>
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (itemTotalItems + receivedTotalItems === 0)
    return (
      <p
        className='py-4 text-center text-muted-foreground text-sm'
        role='status'
      >
        Nenhum item encontrado
      </p>
    )

  return (
    <div className='space-y-3'>
      <p aria-live='polite' className='sr-only' role='status'>
        {itemTotalItems + receivedTotalItems}{' '}
        {itemTotalItems + receivedTotalItems === 1
          ? 'resultado encontrado'
          : 'resultados encontrados'}
      </p>
      <SearchSection
        items={
          items?.map((item) => (
            <SearchItemRow
              item={item}
              key={item.id}
              onOpenItem={onOpenItem}
              workspaceId={workspaceId}
            />
          )) ?? []
        }
        label='Itens do workspace'
        onNext={onNext}
        onPrevious={onPrevious}
        page={itemPage}
        totalItems={itemTotalItems}
        totalPages={itemTotalPages}
      />
      <SearchSection
        items={receivedItems.map((item) => (
          <ReceivedSearchRow
            item={item}
            key={item.id}
            onOpen={onOpenReceived}
          />
        ))}
        label='Compartilhamentos recebidos'
        onNext={onNextReceived}
        onPrevious={onPreviousReceived}
        page={receivedPage}
        totalItems={receivedTotalItems}
        totalPages={receivedTotalPages}
      />
    </div>
  )
}

function SearchSection({
  items,
  label,
  onNext,
  onPrevious,
  page,
  totalItems,
  totalPages,
}: {
  items: React.ReactNode[]
  label: string
  onNext: () => void
  onPrevious: () => void
  page: number
  totalItems: number
  totalPages: number
}) {
  if (totalItems === 0) return null
  return (
    <section aria-label={label} className='space-y-2'>
      <h3 className='font-semibold text-sm'>
        {label} ({totalItems})
      </h3>
      <ul className='divide-y divide-border border-y'>{items}</ul>
      {totalPages > 1 ? (
        <div className='flex items-center justify-between gap-2'>
          <span className='text-muted-foreground text-xs'>
            Página {page + 1} de {totalPages}
          </span>
          <span className='flex gap-2'>
            <Button
              disabled={page === 0}
              onClick={onPrevious}
              size='sm'
              variant='outline'
            >
              Anterior
            </Button>
            <Button
              disabled={page + 1 >= totalPages}
              onClick={onNext}
              size='sm'
              variant='outline'
            >
              Próxima
            </Button>
          </span>
        </div>
      ) : null}
    </section>
  )
}

function SearchItemRow({
  item,
  onOpenItem,
  workspaceId,
}: {
  item: ItemResponse
  onOpenItem: (item: ItemResponse) => void
  workspaceId: string
}) {
  const open = useCallback(() => onOpenItem(item), [item, onOpenItem])
  const path = useQuery({
    enabled: Boolean(item.collectionId),
    queryFn: async () => {
      if (!item.collectionId) return []
      return (await collectionsApi.path(workspaceId, item.collectionId)).data
    },
    queryKey: ['search-item-path', workspaceId, item.collectionId],
  })
  return (
    <li>
      <button
        className='flex min-h-14 w-full items-center gap-3 px-2 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'
        onClick={open}
        type='button'
      >
        <span className='min-w-0 flex-1'>
          <span className='block truncate font-semibold text-sm'>
            {item.title}
          </span>
          {path.data?.length ? (
            <span className='block truncate text-muted-foreground text-xs'>
              {path.data.map(({ name }) => name).join(' / ')}
            </span>
          ) : null}
        </span>
        {item.archivedAt ? <Badge variant='outline'>Arquivado</Badge> : null}
        <Badge variant='secondary'>{typeLabel(item.type)}</Badge>
      </button>
    </li>
  )
}

function ReceivedSearchRow({
  item,
  onOpen,
}: {
  item: ReceivedItemResponse
  onOpen: (item: ReceivedItemResponse) => void
}) {
  const open = useCallback(() => onOpen(item), [item, onOpen])
  return (
    <li>
      <button
        className='flex min-h-14 w-full items-center gap-3 px-2 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'
        onClick={open}
        type='button'
      >
        <span className='min-w-0 flex-1'>
          <span className='block truncate font-semibold text-sm'>
            {item.title}
          </span>
          <span className='block truncate text-muted-foreground text-xs'>
            {item.sourceTeamName} / {item.path}
          </span>
        </span>
        <Badge variant='outline'>Somente leitura</Badge>
        <Badge variant='secondary'>{typeLabel(item.type)}</Badge>
      </button>
    </li>
  )
}
