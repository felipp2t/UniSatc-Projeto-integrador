import { FolderIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { receivedContentApi } from '@/api/endpoints'
import type { ReceivedItemResponse } from '@/api/types'
import { receivedContentKeys } from '@/api/workspace-keys'
import { ReceivedItemDialog } from '@/components/received-item-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'

interface TreeNode {
  children: Map<string, TreeNode>
  entries: ReceivedItemResponse[]
  name: string
}

function buildTree(entries: ReceivedItemResponse[]) {
  const root: TreeNode = {
    children: new Map(),
    entries: [],
    name: 'Compartilhamentos',
  }
  for (const entry of entries) {
    let current = root
    const segments = [
      entry.sourceTeamName,
      ...entry.path.split('/').filter(Boolean),
    ]
    for (const [index, name] of segments.entries()) {
      const key = name
      let child = current.children.get(key)
      if (!child) {
        child = { children: new Map(), entries: [], name }
        current.children.set(key, child)
      }
      current = child
      if (index === segments.length - 1) current.entries.push(entry)
    }
  }
  return root
}

export function ReceivedContentTree({ workspaceId }: { workspaceId: string }) {
  const [selectedId, setSelectedId] = useState<string>()
  const received = useQuery({
    queryFn: async ({ signal }) => {
      const first = (
        await receivedContentApi.list(
          workspaceId,
          { page: 0, size: 100 },
          signal
        )
      ).data
      const remaining = await Promise.all(
        Array.from({ length: first.totalPages - 1 }, (_, index) =>
          receivedContentApi.list(
            workspaceId,
            { page: index + 1, size: 100 },
            signal
          )
        )
      )
      return [first, ...remaining.map(({ data }) => data)].flatMap(
        ({ items }) => items
      )
    },
    queryKey: receivedContentKeys.list(workspaceId, { page: 0, size: 100 }),
  })
  const closeItem = useCallback(() => setSelectedId(undefined), [])
  const retry = useCallback(() => received.refetch(), [received.refetch])

  if (received.isPending)
    return <LoadingState label='Carregando compartilhamentos recebidos…' />
  if (received.isError)
    return <ErrorState error={received.error} onRetry={retry} />
  if (!received.data.length) return null

  const tree = buildTree(received.data)
  return (
    <section aria-labelledby='received-content-heading' className='space-y-3'>
      <h2 className='font-semibold text-sm' id='received-content-heading'>
        Compartilhamentos recebidos
      </h2>
      <ul className='space-y-1 rounded-md border border-border p-2'>
        {[...tree.children.values()].map((node) => (
          <TreeEntry key={nodeKey(node)} node={node} onOpen={setSelectedId} />
        ))}
      </ul>
      {selectedId ? (
        <ReceivedItemDialog
          itemId={selectedId}
          onClose={closeItem}
          workspaceId={workspaceId}
        />
      ) : null}
    </section>
  )
}

function TreeEntry({
  node,
  onOpen,
}: {
  node: TreeNode
  onOpen: (id: string) => void
}) {
  const [firstEntry] = node.entries
  const isFolder =
    node.entries.some((entry) => entry.type === 'folder') ||
    node.children.size > 0
  if (isFolder) {
    return (
      <li>
        <details>
          <summary className='flex min-h-10 cursor-pointer list-none items-center gap-2 rounded px-2 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'>
            <FolderIcon
              aria-hidden='true'
              className='size-4 shrink-0 text-muted-foreground'
            />
            <span className='min-w-0 flex-1 truncate'>{node.name}</span>
            {node.entries.some((entry) => entry.type === 'folder') ? (
              <Badge variant='outline'>Somente leitura</Badge>
            ) : null}
          </summary>
          {node.entries.some((entry) => entry.type !== 'folder') ||
          node.children.size ? (
            <ul className='ml-4 border-border border-l pl-2'>
              {node.entries
                .filter((entry) => entry.type !== 'folder')
                .map((entry) => (
                  <TreeItem
                    entry={entry}
                    key={entry.id}
                    name={node.name}
                    onOpen={onOpen}
                  />
                ))}
              {[...node.children.values()].map((child) => (
                <TreeEntry key={nodeKey(child)} node={child} onOpen={onOpen} />
              ))}
            </ul>
          ) : null}
        </details>
      </li>
    )
  }
  if (!firstEntry) return null
  return (
    <>
      {node.entries.map((entry) => (
        <TreeItem
          entry={entry}
          key={entry.id}
          name={node.name}
          onOpen={onOpen}
        />
      ))}
    </>
  )
}

function TreeItem({
  entry,
  name,
  onOpen,
}: {
  entry: ReceivedItemResponse
  name: string
  onOpen: (id: string) => void
}) {
  const open = useCallback(() => onOpen(entry.id), [entry.id, onOpen])
  return (
    <li>
      <Button
        className='h-auto min-h-10 w-full justify-start gap-2 px-2 py-2 text-left'
        onClick={open}
        variant='ghost'
      >
        <span className='min-w-0 flex-1 truncate'>{name}</span>
        <Badge variant='secondary'>{entry.type}</Badge>
        <Badge variant='outline'>Somente leitura</Badge>
      </Button>
    </li>
  )
}

function nodeKey(node: TreeNode) {
  return `${node.name}:${node.entries.map(({ id }) => id).join(',')}`
}
