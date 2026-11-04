import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { adminWorkspacesQueryKey } from '@/api/admin'
import { adminApi } from '@/api/endpoints'
import type { AdminWorkspaceResponse } from '@/api/types'
import { AdminInviteDialog } from '@/components/admin-invite-dialog'
import { CreateWorkspaceDialog } from '@/components/create-workspace-dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_protected/administracao')({
  component: AdministrationPage,
  head: () => ({
    meta: [{ title: 'Administração | Vaulty' }],
  }),
})

function AdministrationPage() {
  const isSystemAdmin = Route.useRouteContext().session.user?.systemAdmin

  if (!isSystemAdmin) {
    return (
      <main className='container mx-auto px-4 py-8 md:px-8 md:py-12'>
        <EmptyState
          description='Somente o administrador geral pode gerenciar os workspaces.'
          title='Acesso restrito'
        />
      </main>
    )
  }

  return <WorkspaceAdministration />
}

function WorkspaceAdministration() {
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
            Administração
          </h1>
          <p className='text-muted-foreground text-xs'>
            Crie um workspace por equipe e convide seus proprietários e membros.
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
      {workspaces.data ? <WorkspaceTable workspaces={workspaces.data} /> : null}
    </main>
  )
}

function WorkspaceTable({
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workspace</TableHead>
          <TableHead>Proprietário</TableHead>
          <TableHead>Membros</TableHead>
          <TableHead>Convites pendentes</TableHead>
          <TableHead>
            <span className='sr-only'>Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workspaces.map((workspace) => (
          <WorkspaceRow key={workspace.id} workspace={workspace} />
        ))}
      </TableBody>
    </Table>
  )
}

function WorkspaceRow({ workspace }: { workspace: AdminWorkspaceResponse }) {
  const pendingInvites = workspace.pendingInvites ?? []

  return (
    <TableRow>
      <TableCell>
        <span className='font-mono font-semibold'>{workspace.name}</span>
        {workspace.description ? (
          <p className='text-muted-foreground'>{workspace.description}</p>
        ) : null}
      </TableCell>
      <TableCell>
        {workspace.ownerName ? (
          <>
            <span>{workspace.ownerName}</span>
            <p className='text-muted-foreground'>{workspace.ownerEmail}</p>
          </>
        ) : (
          <span className='text-muted-foreground'>Sem proprietário</span>
        )}
      </TableCell>
      <TableCell>{workspace.memberCount}</TableCell>
      <TableCell>
        {pendingInvites.length === 0 ? (
          <span className='text-muted-foreground'>Nenhum</span>
        ) : (
          <ul className='space-y-1'>
            {pendingInvites.map((invite) => (
              <li className='flex items-center gap-2' key={invite.id}>
                <span>{invite.email}</span>
                <Badge variant={invite.owner ? 'default' : 'outline'}>
                  {invite.owner ? 'Proprietário' : 'Membro'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </TableCell>
      <TableCell className='text-right'>
        {workspace.id ? (
          <AdminInviteDialog
            workspaceId={workspace.id}
            workspaceName={workspace.name ?? 'workspace'}
          />
        ) : null}
      </TableCell>
    </TableRow>
  )
}
