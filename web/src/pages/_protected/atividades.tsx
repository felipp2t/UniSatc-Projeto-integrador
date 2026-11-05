import { ClockCounterClockwiseIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { isForbiddenOrNotFound } from '@/api/http-status'
import type {
  ActivityAction,
  ActivityFilters,
  ActivityResourceType,
} from '@/api/types'
import { workspaceMembersQueryKey } from '@/api/workspace-keys'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationControls } from '@/components/workspace-collections'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'

const PAGE_SIZE = 20

const actionLabels: Record<ActivityAction, string> = {
  content_publication_revoked: 'revogou uma publicação',
  content_published: 'publicou conteúdo',
  folder_created: 'criou uma pasta',
  folder_deleted: 'excluiu uma pasta',
  folder_renamed: 'renomeou uma pasta',
  group_created: 'criou um grupo',
  group_deleted: 'excluiu um grupo',
  group_member_added: 'adicionou alguém a um grupo',
  group_member_removed: 'removeu alguém de um grupo',
  group_renamed: 'renomeou um grupo',
  item_archived: 'arquivou um item',
  item_created: 'criou um item',
  item_deleted: 'excluiu um item',
  item_restored: 'restaurou um item',
  item_updated: 'atualizou um item',
  member_invite_declined: 'recusou um convite',
  member_invite_revoked: 'revogou um convite',
  member_invited: 'convidou uma pessoa',
  member_joined: 'entrou no workspace',
  member_removed: 'removeu uma pessoa',
  member_role_changed: 'alterou o papel de uma pessoa',
  role_created: 'criou um papel',
  role_deleted: 'excluiu um papel',
  role_permissions_changed: 'alterou as permissões de um papel',
  role_renamed: 'renomeou um papel',
  team_created: 'criou um time',
  team_deleted: 'excluiu um time',
  team_leader_changed: 'alterou a liderança de um time',
  team_member_added: 'adicionou alguém a um time',
  team_member_removed: 'removeu alguém de um time',
  team_renamed: 'renomeou um time',
  workspace_renamed: 'renomeou o workspace',
}

const resourceLabels: Record<ActivityResourceType, string> = {
  folder: 'Pasta',
  group: 'Grupo',
  item: 'Item',
  member: 'Membro',
  publication: 'Publicação',
  role: 'Papel',
  team: 'Time',
  workspace: 'Workspace',
}

const actionOptions = Object.entries(actionLabels) as [ActivityAction, string][]
const resourceOptions = Object.entries(resourceLabels) as [
  ActivityResourceType,
  string,
][]

export const Route = createFileRoute('/_protected/atividades')({
  component: ActivityHistoryPage,
  head: () => ({ meta: [{ title: 'Histórico de atividades | Vaulty' }] }),
  staticData: { permission: { action: 'read', resource: 'activity' } },
})

function ActivityHistoryPage() {
  const workspace = useCurrentWorkspace()
  const retryWorkspace = useCallback(async () => {
    await workspace.refetch()
  }, [workspace.refetch])

  if (workspace.isPending) return <LoadingState label='Carregando workspace…' />
  if (workspace.isError) {
    return <ErrorState error={workspace.error} onRetry={retryWorkspace} />
  }
  if (!workspace.data?.id) {
    return (
      <main className='container mx-auto px-4 py-8 md:px-8 md:py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar o histórico.'
          title='Nenhum workspace disponível'
        />
      </main>
    )
  }

  return <ActivityHistory workspaceId={workspace.data.id} />
}

function ActivityHistory({ workspaceId }: { workspaceId: string }) {
  const actorLabelId = useId()
  const actionLabelId = useId()
  const resourceLabelId = useId()
  const [filters, setFilters] = useState<{
    action: ActivityAction | ''
    actorId: string
    from: string
    page: number
    resourceType: ActivityResourceType | ''
    to: string
  }>({
    action: '',
    actorId: '',
    from: '',
    page: 0,
    resourceType: '',
    to: '',
  })
  const members = useQuery({
    queryFn: async () => (await workspaceApi.listMembers(workspaceId)).data,
    queryKey: workspaceMembersQueryKey(workspaceId),
  })
  const updateFilter = useCallback(
    <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) =>
      setFilters((current) => ({ ...current, [key]: value, page: 0 })),
    []
  )
  const changeActor = useCallback(
    (value: string) => updateFilter('actorId', value === 'all' ? '' : value),
    [updateFilter]
  )
  const changeAction = useCallback(
    (value: string) =>
      updateFilter('action', value === 'all' ? '' : (value as ActivityAction)),
    [updateFilter]
  )
  const changeResourceType = useCallback(
    (value: string) =>
      updateFilter(
        'resourceType',
        value === 'all' ? '' : (value as ActivityResourceType)
      ),
    [updateFilter]
  )
  const changeFrom = useCallback(
    (value: string) => updateFilter('from', value),
    [updateFilter]
  )
  const changeTo = useCallback(
    (value: string) => updateFilter('to', value),
    [updateFilter]
  )
  const activityFilters: ActivityFilters = {
    action: filters.action || undefined,
    actorId: filters.actorId || undefined,
    from: filters.from
      ? new Date(`${filters.from}T00:00:00`).toISOString()
      : undefined,
    page: filters.page,
    resourceType: filters.resourceType || undefined,
    size: PAGE_SIZE,
    to: filters.to
      ? new Date(`${filters.to}T23:59:59.999`).toISOString()
      : undefined,
  }
  const activity = useQuery({
    queryFn: async () =>
      (await workspaceApi.activity(workspaceId, activityFilters)).data,
    queryKey: ['workspace-activity', workspaceId, activityFilters],
  })
  const retryActivity = useCallback(async () => {
    await activity.refetch()
  }, [activity.refetch])
  const nextPage = useCallback(
    () => setFilters((current) => ({ ...current, page: current.page + 1 })),
    []
  )
  const previousPage = useCallback(
    () =>
      setFilters((current) => ({
        ...current,
        page: Math.max(0, current.page - 1),
      })),
    []
  )

  return (
    <main className='container mx-auto flex min-h-full flex-col gap-7 px-4 py-8 md:px-8 md:py-12'>
      <header className='flex flex-col gap-6 border-border border-b pb-6'>
        <AppBreadcrumb
          items={[{ label: 'Início', to: '/' }, { label: 'Atividades' }]}
        />
        <div className='flex items-center gap-4'>
          <ClockCounterClockwiseIcon
            aria-hidden='true'
            className='size-6 shrink-0 text-primary'
          />
          <div>
            <p className='mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em]'>
              Workspace
            </p>
            <h1 className='font-bold font-mono text-2xl uppercase tracking-tight md:text-3xl'>
              Histórico de atividades
            </h1>
          </div>
        </div>
      </header>

      <section
        aria-label='Filtros do histórico'
        className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'
      >
        <div className='space-y-2'>
          <label
            className='font-mono text-[10px] text-muted-foreground uppercase tracking-wide'
            htmlFor={actorLabelId}
          >
            Pessoa
          </label>
          <Select onValueChange={changeActor} value={filters.actorId || 'all'}>
            <SelectTrigger aria-labelledby={actorLabelId} id={actorLabelId}>
              <SelectValue placeholder='Todas as pessoas' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas as pessoas</SelectItem>
              {members.data?.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <label
            className='font-mono text-[10px] text-muted-foreground uppercase tracking-wide'
            htmlFor={actionLabelId}
          >
            Ação
          </label>
          <Select onValueChange={changeAction} value={filters.action || 'all'}>
            <SelectTrigger aria-labelledby={actionLabelId} id={actionLabelId}>
              <SelectValue placeholder='Todas as ações' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas as ações</SelectItem>
              {actionOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <label
            className='font-mono text-[10px] text-muted-foreground uppercase tracking-wide'
            htmlFor={resourceLabelId}
          >
            Tipo de recurso
          </label>
          <Select
            onValueChange={changeResourceType}
            value={filters.resourceType || 'all'}
          >
            <SelectTrigger
              aria-labelledby={resourceLabelId}
              id={resourceLabelId}
            >
              <SelectValue placeholder='Todos os tipos' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos os tipos</SelectItem>
              {resourceOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <label
            className='font-mono text-[10px] text-muted-foreground uppercase tracking-wide'
            htmlFor='activity-from'
          >
            De
          </label>
          <Input
            id='activity-from'
            max={filters.to || undefined}
            onValueChange={changeFrom}
            type='date'
            value={filters.from}
          />
        </div>
        <div className='space-y-2'>
          <label
            className='font-mono text-[10px] text-muted-foreground uppercase tracking-wide'
            htmlFor='activity-to'
          >
            Até
          </label>
          <Input
            id='activity-to'
            min={filters.from || undefined}
            onValueChange={changeTo}
            type='date'
            value={filters.to}
          />
        </div>
      </section>

      {activity.isPending ? (
        <LoadingState label='Carregando histórico…' />
      ) : null}
      {activity.isError ? (
        <ErrorState
          error={activity.error}
          message={
            isForbiddenOrNotFound(activity.error)
              ? 'Você não tem permissão para consultar o histórico deste workspace.'
              : undefined
          }
          onRetry={retryActivity}
        />
      ) : null}
      {activity.data && activity.data.activities.length === 0 ? (
        <EmptyState
          description='Não há atividades para os filtros selecionados.'
          title='Nenhuma atividade encontrada'
        />
      ) : null}
      {activity.data && activity.data.activities.length > 0 ? (
        <section aria-label='Atividades do workspace' className='space-y-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Data e hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.data.activities.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className='font-semibold'>
                    {entry.actorName}
                  </TableCell>
                  <TableCell>{actionLabels[entry.action]}</TableCell>
                  <TableCell>
                    <span className='mr-2 text-muted-foreground'>
                      {resourceLabels[entry.resourceType]}
                    </span>
                    {getSnapshotName(entry.snapshot) ?? '—'}
                  </TableCell>
                  <TableCell className='whitespace-nowrap text-muted-foreground'>
                    {formatActivityTime(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {activity.data.totalPages > 1 ? (
            <PaginationControls
              isFetching={activity.isFetching}
              onNext={nextPage}
              onPrevious={previousPage}
              page={activity.data.page}
              totalPages={activity.data.totalPages}
            />
          ) : null}
        </section>
      ) : null}
      <Link
        className='self-start font-mono text-muted-foreground text-xs underline-offset-4 hover:text-primary hover:underline'
        to='/'
      >
        Voltar ao workspace
      </Link>
    </main>
  )
}

function getSnapshotName(snapshot: Record<string, unknown> | null) {
  if (!snapshot) return null
  const name = snapshot.name ?? snapshot.title ?? snapshot.previousName
  return typeof name === 'string' ? name : null
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}
