import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { workspaceRolesQueryKey } from '@/api/workspace-keys'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { WorkspaceSettingsLayout } from '@/components/workspace-settings-layout'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export const Route = createFileRoute(
  '/_protected/configuracoes_/cargos'
)({
  component: WorkspaceRolesPage,
  head: () => ({
    meta: [{ title: 'Cargos | Configurações do workspace | Vaulty' }],
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
  const retryRoles = useCallback(async () => {
    await roles.refetch()
  }, [roles.refetch])

  if (workspace.isPending) return <LoadingState label='Carregando workspace…' />
  if (workspace.isError)
    return (
      <ErrorState
        error={workspace.error}
        message='Não foi possível carregar seu workspace.'
        onRetry={workspace.refetch}
      />
    )
  if (!workspaceId)
    return (
      <EmptyState
        description='Você precisa estar vinculado a um workspace para consultar os cargos.'
        title='Nenhum workspace disponível'
      />
    )
  if (permissions.isPending)
    return <LoadingState label='Verificando permissão…' />
  if (permissions.isError)
    return (
      <ErrorState
        error={permissions.error}
        message='Não foi possível confirmar sua permissão.'
        onRetry={permissions.refetch}
      />
    )
  if (!permissions.isOwner)
    return (
      <ErrorState message='Somente o dono pode consultar o catálogo de cargos.' />
    )
  if (roles.isPending) return <LoadingState label='Carregando cargos…' />
  if (roles.isError)
    return (
      <ErrorState
        error={roles.error}
        message='Não foi possível carregar os cargos.'
        onRetry={retryRoles}
      />
    )

  return (
    <WorkspaceSettingsLayout
      breadcrumbLabel='Cargos'
      breadcrumbParentLabel='Configurações do workspace'
      canManageGroups={permissions.canManageTeams}
      canManageRoles={permissions.isOwner}
    >
      <section
        aria-labelledby='workspace-roles-title'
        className='min-w-0 flex-1 space-y-4'
      >
        <header>
          <h2
            className='font-mono font-semibold text-sm uppercase tracking-wide'
            id='workspace-roles-title'
          >
            Catálogo de cargos
          </h2>
          <p className='mt-1 max-w-2xl text-muted-foreground text-sm'>
            Os cargos são definidos pelo sistema. O dono atribui os papéis
            globais; Líder e Membro são atribuídos pela gestão de times.
          </p>
        </header>
        {(roles.data ?? []).map((role) => (
          <article
            className='rounded-md border border-border p-4'
            key={role.code}
          >
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
              <h3 className='font-semibold'>{role.name}</h3>
              <span className='font-mono text-muted-foreground text-xs'>
                {role.code} · {role.scope === 'GLOBAL' ? 'Global' : 'Time'}
              </span>
            </div>
            <ul
              aria-label={`Permissões de ${role.name}`}
              className='mt-3 flex flex-wrap gap-2'
            >
              {role.permissions.map((permission) => (
                <li
                  className='rounded-sm border border-border px-2 py-1 font-mono text-xs'
                  key={`${permission.resource}:${permission.action}`}
                >
                  {permission.resource} · {permission.action}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </WorkspaceSettingsLayout>
  )
}
