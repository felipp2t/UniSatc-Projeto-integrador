import { UsersThreeIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { accessGroupApi } from '@/api/endpoints'
import { isForbiddenOrNotFound } from '@/api/http-status'
import type { AccessGroupResponse } from '@/api/types'
import { accessGroupsQueryKey } from '@/api/workspace-keys'
import { AccessGroupListItem } from '@/components/access-group-list-item'
import { AccessGroupMembers } from '@/components/access-group-members'
import { AccessGroupNameForm } from '@/components/access-group-name-form'
import { DeleteAccessGroupDialog } from '@/components/delete-access-group-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { WorkspaceSettingsLayout } from '@/components/workspace-settings-layout'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export const Route = createFileRoute(
  '/_protected/configuracoes-workspace_/grupos'
)({
  component: AccessGroupsPage,
  head: () => ({
    meta: [{ title: 'Grupos | Configurações do workspace | Vaulty' }],
  }),
})

function AccessGroupsPage() {
  const workspace = useCurrentWorkspace()
  const workspaceId = workspace.data?.id
  const permissions = useWorkspacePermissions(workspaceId)
  const [selectedGroup, setSelectedGroup] = useState<AccessGroupResponse>()
  const [editingGroupId, setEditingGroupId] = useState<string>()
  const [deleteGroup, setDeleteGroup] = useState<AccessGroupResponse>()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const groups = useQuery({
    enabled: Boolean(workspaceId && permissions.can('group', 'manage')),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await accessGroupApi.list(workspaceId)).data
    },
    queryKey: accessGroupsQueryKey(workspaceId),
  })
  const currentGroup =
    groups.data?.find((group) => group.id === selectedGroup?.id) ??
    groups.data?.[0]
  const retryWorkspace = useCallback(async () => {
    await workspace.refetch()
  }, [workspace.refetch])
  const retryPermissions = useCallback(async () => {
    await permissions.refetch()
  }, [permissions.refetch])
  const retryGroups = useCallback(async () => {
    await groups.refetch()
  }, [groups.refetch])
  const selectGroup = useCallback(
    (group: AccessGroupResponse) => setSelectedGroup(group),
    []
  )
  const editGroup = useCallback(
    (group: AccessGroupResponse | undefined) => setEditingGroupId(group?.id),
    []
  )
  const openDelete = useCallback(
    (group: AccessGroupResponse) => setDeleteGroup(group),
    []
  )
  const closeDelete = useCallback(() => setDeleteGroup(undefined), [])
  const handleDeleteOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeDelete()
    },
    [closeDelete]
  )
  const clearSelectedGroup = useCallback(() => {
    setSelectedGroup(undefined)
    titleRef.current?.focus()
  }, [])

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
        description='Você precisa estar vinculado a um workspace para gerenciar grupos.'
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
        message='Não foi possível confirmar sua permissão para gerenciar grupos.'
        onRetry={retryPermissions}
      />
    )
  }
  if (!permissions.can('group', 'manage')) {
    return (
      <ErrorState message='Você não tem permissão para gerenciar grupos neste workspace.' />
    )
  }
  if (groups.isPending) return <LoadingState label='Carregando grupos…' />
  if (groups.isError) {
    return (
      <ErrorState
        error={groups.error}
        message={
          isForbiddenOrNotFound(groups.error)
            ? 'Acesso à gestão de grupos indisponível. Verifique sua permissão ou vínculo com o workspace.'
            : 'Não foi possível carregar os grupos.'
        }
        onRetry={retryGroups}
      />
    )
  }

  return (
    <WorkspaceSettingsLayout
      breadcrumbLabel='Grupos'
      breadcrumbParentLabel='Configurações do Workspace'
      canManageGroups={permissions.can('group', 'manage')}
    >
      <section
        aria-labelledby='access-groups-title'
        className='min-w-0 flex-1 space-y-5'
      >
        <header>
          <h2
            className='font-mono font-semibold text-sm uppercase tracking-wide'
            id='access-groups-title'
            ref={titleRef}
            tabIndex={-1}
          >
            Grupos de acesso
          </h2>
          <p className='mt-1 max-w-2xl text-muted-foreground text-sm'>
            Organize integrantes em grupos para compartilhar recursos. A
            participação não altera o papel da pessoa.
          </p>
        </header>
        <AccessGroupNameForm onSaved={selectGroup} workspaceId={workspaceId} />
        {groups.data.length === 0 ? (
          <EmptyState
            description='Crie um grupo para organizar quem pode acessar os recursos compartilhados.'
            icon={<UsersThreeIcon aria-hidden='true' size={24} />}
            title='Nenhum grupo criado'
          />
        ) : (
          <div className='grid min-w-0 gap-5 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]'>
            <ul
              aria-label='Grupos de acesso'
              className='divide-y divide-border rounded-md border border-border'
            >
              {groups.data.map((group) => (
                <AccessGroupListItem
                  editing={editingGroupId === group.id}
                  group={group}
                  key={group.id}
                  onDelete={openDelete}
                  onEdit={editGroup}
                  onSelect={selectGroup}
                  selected={currentGroup?.id === group.id}
                  workspaceId={workspaceId}
                />
              ))}
            </ul>
            {currentGroup ? (
              <section
                aria-labelledby='group-members-title'
                className='min-w-0 space-y-4 rounded-md border border-border p-4'
              >
                <div>
                  <h3
                    className='break-words font-semibold text-base'
                    id='group-members-title'
                  >
                    {currentGroup.name}
                  </h3>
                  <p className='mt-1 text-muted-foreground text-sm'>
                    Integrantes do grupo
                  </p>
                </div>
                <AccessGroupMembers
                  group={currentGroup}
                  key={currentGroup.id}
                  workspaceId={workspaceId}
                />
              </section>
            ) : null}
          </div>
        )}
      </section>
      <DeleteAccessGroupDialog
        group={deleteGroup}
        onDeleted={clearSelectedGroup}
        onOpenChange={handleDeleteOpenChange}
        open={Boolean(deleteGroup)}
        workspaceId={workspaceId}
      />
    </WorkspaceSettingsLayout>
  )
}
