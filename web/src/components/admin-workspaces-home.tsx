import { CaretRightIcon, UsersIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useCallback } from 'react'
import { adminWorkspacesQueryKey } from '@/api/admin'
import { adminApi } from '@/api/endpoints'
import type { AdminWorkspaceResponse } from '@/api/types'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'

export function AdminWorkspacesHome() {
  const workspaces = useQuery({
    queryFn: async () => (await adminApi.listWorkspaces()).data,
    queryKey: adminWorkspacesQueryKey,
  })
  const retry = useCallback(async () => {
    await workspaces.refetch()
  }, [workspaces.refetch])

  return (
    <main className='container mx-auto space-y-6 px-4 py-8 md:px-8 md:py-12'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='font-mono font-semibold text-sm uppercase tracking-wide'>
            Workspaces
          </h1>
          <p className='text-muted-foreground text-xs'>
            Crie um workspace por equipe e, em seguida, configure-o e convide
            seus proprietários e membros.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>
      {workspaces.isPending ? (
        <LoadingState label='Carregando workspaces…' />
      ) : null}
      {workspaces.isError ? (
        <ErrorState
          error={workspaces.error}
          message='Não foi possível carregar os workspaces.'
          onRetry={retry}
        />
      ) : null}
      {workspaces.data ? <WorkspaceGrid workspaces={workspaces.data} /> : null}
    </main>
  )
}

function WorkspaceGrid({
  workspaces,
}: {
  workspaces: AdminWorkspaceResponse[]
}) {
  if (workspaces.length === 0) {
    return (
      <EmptyState
        description='Crie o primeiro workspace para uma equipe.'
        title='Nenhum workspace'
      />
    )
  }

  return (
    <ul className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {workspaces.map((workspace) => (
        <li key={workspace.id}>
          <WorkspaceSummaryCard workspace={workspace} />
        </li>
      ))}
    </ul>
  )
}

function WorkspaceSummaryCard({
  workspace,
}: {
  workspace: AdminWorkspaceResponse
}) {
  const pendingCount = workspace.pendingInvites?.length ?? 0

  return (
    <Link
      className='group flex h-full flex-col gap-3 border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none'
      params={{ workspaceId: workspace.id ?? '' }}
      to='/administracao/$workspaceId'
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='font-mono font-semibold text-sm'>
          {workspace.name}
        </span>
        <CaretRightIcon
          aria-hidden='true'
          className='text-muted-foreground group-hover:text-primary'
          size={14}
        />
      </div>
      {workspace.description ? (
        <p className='line-clamp-2 text-muted-foreground text-xs'>
          {workspace.description}
        </p>
      ) : null}
      <div className='mt-auto space-y-2 text-xs'>
        <p>
          <span className='text-muted-foreground'>Proprietário: </span>
          {workspace.ownerName ?? 'aguardando convite'}
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='inline-flex items-center gap-1 text-muted-foreground'>
            <UsersIcon aria-hidden='true' size={12} />
            {workspace.memberCount} membro(s)
          </span>
          {pendingCount > 0 ? (
            <Badge variant='outline'>
              {pendingCount} convite(s) pendente(s)
            </Badge>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
