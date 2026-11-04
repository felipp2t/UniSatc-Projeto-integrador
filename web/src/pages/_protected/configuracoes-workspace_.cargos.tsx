import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { workspaceRolesQueryKey } from '@/api/workspace-keys'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { WorkspaceRolesSection } from '@/components/workspace-roles-section'
import { WorkspaceSettingsLayout } from '@/components/workspace-settings-layout'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export const Route = createFileRoute(
  '/_protected/configuracoes-workspace_/cargos'
)({
  component: WorkspaceRolesPage,
  head: () => ({
    meta: [
      { title: 'Cargos e permissões | Configurações do workspace | Vaulty' },
    ],
  }),
})

function WorkspaceRolesPage() {
  const workspace = useCurrentWorkspace()
  const workspaceId = workspace.data?.id
  const permissions = useWorkspacePermissions(workspaceId)
  const roles = useQuery({
    enabled: Boolean(workspaceId && permissions.isOwner),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceApi.listRoles(workspaceId)).data
    },
    queryKey: workspaceRolesQueryKey(workspaceId),
  })
  const retryWorkspace = useCallback(async () => {
    await workspace.refetch()
  }, [workspace.refetch])
  const retryPermissions = useCallback(async () => {
    await permissions.refetch()
  }, [permissions.refetch])
  const retryRoles = useCallback(async () => {
    await roles.refetch()
  }, [roles.refetch])

  if (workspace.isPending) return <LoadingState label='Carregando workspace…' />
  if (workspace.isError) {
    return (
      <ErrorState
        error={workspace.error}
        message='Não foi possível carregar seu workspace.'
        onRetry={retryWorkspace}
      />
    )
  }
  if (!workspaceId) {
    return (
      <EmptyState
        description='Você precisa estar vinculado a um workspace para gerenciar cargos.'
        title='Nenhum workspace disponível'
      />
    )
  }
  if (permissions.isPending)
    return <LoadingState label='Verificando permissão…' />
  if (permissions.isError) {
    return (
      <ErrorState
        error={permissions.error}
        message='Não foi possível confirmar sua permissão para gerenciar cargos.'
        onRetry={retryPermissions}
      />
    )
  }
  if (!permissions.isOwner) {
    return (
      <ErrorState message='Somente um dono pode gerenciar cargos e permissões neste workspace.' />
    )
  }
  if (roles.isPending) return <LoadingState label='Carregando cargos…' />
  if (roles.isError) {
    return (
      <ErrorState
        error={roles.error}
        message='Não foi possível carregar os cargos.'
        onRetry={retryRoles}
      />
    )
  }

  return (
    <WorkspaceSettingsLayout
      breadcrumbLabel='Cargos e permissões'
      breadcrumbParentLabel='Configurações do workspace'
      canManageGroups={permissions.can('group', 'manage')}
      canManageRoles={permissions.isOwner}
    >
      <section className='min-w-0 flex-1'>
        <WorkspaceRolesSection
          onRetry={retryRoles}
          roles={roles.data ?? []}
          rolesError={roles.error}
          rolesPending={roles.isPending}
          workspaceId={workspaceId}
        />
      </section>
    </WorkspaceSettingsLayout>
  )
}
