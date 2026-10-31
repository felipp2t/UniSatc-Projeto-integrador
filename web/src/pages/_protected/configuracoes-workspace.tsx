import {
  GearIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react'
import {
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { isForbiddenOrNotFound } from '@/api/http-status'
import {
  getMemberPermissions,
  isWorkspaceOwner,
  type MemberPermissions,
} from '@/api/member-permissions'
import type {
  WorkspaceMemberResponse,
  WorkspaceRoleResponse,
} from '@/api/types'
import {
  workspaceMembersQueryKey,
  workspaceRolesQueryKey,
} from '@/api/workspace-keys'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { InviteMemberDialog } from '@/components/invite-member-dialog'
import { PendingInvitesSection } from '@/components/pending-invites-section'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { appToast } from '@/components/ui/toast'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'

export const Route = createFileRoute('/_protected/configuracoes-workspace')({
  component: WorkspaceSettingsPage,
  head: () => ({ meta: [{ title: 'Membros do workspace | Vaulty' }] }),
})

function WorkspaceSettingsPage() {
  const { session } = Route.useRouteContext()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: WorkspaceMemberResponse
    roleId: string
    roleName: string
  } | null>(null)
  const queryClient = useQueryClient()
  const workspaces = useCurrentWorkspace()
  const currentWorkspace = workspaces.data
  const workspaceId = currentWorkspace?.id
  const members = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceApi.listMembers(workspaceId)).data
    },
    queryKey: workspaceMembersQueryKey(workspaceId),
  })
  const currentUserRole = members.data?.find(
    (member) => member.userId === session.user?.id
  )?.roleName
  const isOwner = isWorkspaceOwner(currentUserRole)
  const roles = useQuery({
    enabled: Boolean(workspaceId && isOwner),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceApi.listRoles(workspaceId)).data
    },
    queryKey: workspaceRolesQueryKey(workspaceId),
  })
  const retryWorkspaces = useCallback(async () => {
    await workspaces.refetch()
  }, [workspaces.refetch])
  const retryMembers = useCallback(async () => {
    await members.refetch()
  }, [members.refetch])
  const retryRoles = useCallback(async () => {
    await roles.refetch()
  }, [roles.refetch])
  const changeRole = useMutation({
    mutationFn: ({
      memberId,
      roleId,
    }: {
      memberId: string
      roleId: string
    }) => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return workspaceApi.changeMemberRole(workspaceId, memberId, roleId)
    },
    onError: (error) =>
      appToast.error(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível alterar o cargo.',
          statusMessages: {
            409: 'O servidor recusou a alteração para proteger o último dono do workspace.',
          },
        })
      ),
    onSuccess: async () => {
      appToast.success('Cargo alterado com sucesso.')
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceMembersQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceRolesQueryKey(workspaceId),
        }),
      ])
    },
  })
  const handleRoleSelection = useCallback(
    (member: WorkspaceMemberResponse, roleId: string) => {
      const roleName = roles.data?.find((role) => role.id === roleId)?.name
      if (roleName) setPendingRoleChange({ member, roleId, roleName })
    },
    [roles.data]
  )
  const handleRoleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setPendingRoleChange(null)
  }, [])
  const handleCancelRoleChange = useCallback(() => {
    setPendingRoleChange(null)
  }, [])
  const handleConfirmRoleChange = useCallback(() => {
    if (!pendingRoleChange) return
    changeRole.mutate({
      memberId: pendingRoleChange.member.id,
      roleId: pendingRoleChange.roleId,
    })
    setPendingRoleChange(null)
  }, [changeRole.mutate, pendingRoleChange])
  const roleNames = useMemo(
    () =>
      [
        ...new Set((members.data ?? []).map((member) => member.roleName)),
      ].sort(),
    [members.data]
  )
  const filteredMembers = (members.data ?? []).filter((member) => {
    const matchesName = member.name
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
    return (
      matchesName && (roleFilter === 'all' || member.roleName === roleFilter)
    )
  })
  const memberAccessError = members.isError ? members.error : undefined
  const memberAccessDenied = isForbiddenOrNotFound(memberAccessError)

  if (workspaces.isPending)
    return <LoadingState label='Carregando workspace…' />
  if (workspaces.isError)
    return (
      <ErrorState
        error={workspaces.error}
        message='Não foi possível carregar seu workspace. Se você perdeu o vínculo, procure um dono.'
        onRetry={retryWorkspaces}
      />
    )
  if (!currentWorkspace?.id) {
    return (
      <main className='container mx-auto px-4 py-8 md:px-8 md:py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar os membros. Peça a um dono para verificar seu acesso.'
          title='Nenhum workspace disponível'
        />
      </main>
    )
  }

  return (
    <main className='container mx-auto space-y-6 px-4 py-8 md:px-8 md:py-12'>
      <header className='flex flex-col gap-6'>
        <AppBreadcrumb
          items={[
            { label: 'Início', to: '/' },
            { label: 'Membros do workspace' },
          ]}
        />
        <div className='flex min-w-0 items-center gap-4'>
          <GearIcon
            aria-hidden='true'
            className='size-6 shrink-0 text-primary'
          />
          <h1 className='truncate font-bold font-mono text-xl md:text-3xl'>
            MEMBROS DO WORKSPACE
          </h1>
        </div>
      </header>
      <div className='flex min-w-0 flex-col gap-8 md:flex-row'>
        <nav
          aria-label='Configurações do workspace'
          className='hidden w-full shrink-0 flex-col gap-1 md:flex md:w-52'
        >
          <Link
            activeProps={{
              className: 'border-primary bg-primary/10 text-primary',
            }}
            className='flex items-center gap-2.5 border-l-2 px-3 py-2 font-mono font-semibold text-xs uppercase tracking-wide transition-colors'
            inactiveProps={{
              className:
                'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
            }}
            to='/configuracoes-workspace'
          >
            <UsersThreeIcon aria-hidden='true' className='size-3.5 shrink-0' />{' '}
            Membros
          </Link>
        </nav>
        <Separator className='hidden h-auto md:block' orientation='vertical' />
        <section aria-label='Membros e convites' className='min-w-0 flex-1'>
          <Tabs defaultValue='members'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <TabsList>
                <TabsTrigger value='members'>
                  Membros ({members.isError ? 0 : (members.data?.length ?? 0)})
                </TabsTrigger>
                {isOwner ? (
                  <TabsTrigger value='invites'>Convites</TabsTrigger>
                ) : null}
              </TabsList>
              {isOwner ? <InviteMemberDialog /> : null}
            </div>
            <TabsContent className='mt-4 space-y-4' value='members'>
              <div className='flex flex-col gap-2 md:flex-row'>
                <div className='relative flex-1'>
                  <label className='sr-only' htmlFor='member-search'>
                    Buscar membro por nome
                  </label>
                  <MagnifyingGlassIcon
                    aria-hidden='true'
                    className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
                  />
                  <Input
                    className='pl-9'
                    id='member-search'
                    onValueChange={setSearch}
                    placeholder='Buscar por nome'
                    value={search}
                  />
                </div>
                <Select onValueChange={setRoleFilter} value={roleFilter}>
                  <SelectTrigger
                    aria-label='Filtrar por cargo'
                    className='w-full md:w-40'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos os cargos</SelectItem>
                    {roleNames.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <MembersList
                currentUserRole={currentUserRole}
                filteredMembers={filteredMembers}
                isChangingRole={changeRole.isPending}
                isOwner={isOwner}
                isRolesError={roles.isError}
                isRolesLoading={roles.isPending}
                memberAccessDenied={memberAccessDenied}
                members={members}
                onChangeRole={handleRoleSelection}
                onRetry={retryMembers}
                onRetryRoles={retryRoles}
                roles={roles.data ?? []}
              />
            </TabsContent>
            {isOwner ? (
              <TabsContent className='mt-4' value='invites'>
                <PendingInvitesSection />
              </TabsContent>
            ) : null}
          </Tabs>
        </section>
      </div>
      <Dialog
        onOpenChange={handleRoleDialogOpenChange}
        open={pendingRoleChange !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteração de cargo</DialogTitle>
            <DialogDescription>
              {pendingRoleChange
                ? `Alterar o cargo de ${pendingRoleChange.member.name} para ${pendingRoleChange.roleName}?`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={changeRole.isPending}
              onClick={handleCancelRoleChange}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              disabled={!pendingRoleChange || changeRole.isPending}
              onClick={handleConfirmRoleChange}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function MembersList({
  filteredMembers,
  isOwner,
  memberAccessDenied,
  members,
  onRetry,
  roles,
  isRolesLoading,
  isRolesError,
  onRetryRoles,
  isChangingRole,
  onChangeRole,
  currentUserRole,
}: {
  filteredMembers: WorkspaceMemberResponse[]
  isOwner: boolean
  memberAccessDenied: boolean
  members: UseQueryResult<WorkspaceMemberResponse[]>
  onRetry: () => Promise<void>
  roles: WorkspaceRoleResponse[]
  isRolesLoading: boolean
  isRolesError: boolean
  onRetryRoles: () => Promise<void>
  isChangingRole: boolean
  onChangeRole: (member: WorkspaceMemberResponse, roleId: string) => void
  currentUserRole: string | undefined
}) {
  if (members.isPending) return <LoadingState label='Carregando membros…' />
  if (members.isError) {
    return (
      <ErrorState
        error={members.error}
        message={
          memberAccessDenied
            ? 'Acesso ao workspace negado. Se você perdeu o vínculo, procure um dono.'
            : 'Não foi possível carregar os membros.'
        }
        onRetry={onRetry}
      />
    )
  }
  if (members.data.length === 0) {
    return (
      <EmptyState
        description='Este workspace ainda não tem membros.'
        title='Nenhum membro encontrado'
      />
    )
  }
  if (filteredMembers.length === 0) {
    return (
      <EmptyState
        description='Ajuste a busca ou o filtro de cargo.'
        title='Nenhum resultado'
        variant='compact'
      />
    )
  }

  const ownerCount = members.data.filter((member) =>
    isWorkspaceOwner(member.roleName)
  ).length
  const membersWithPermissions = filteredMembers.map((member) => ({
    member,
    permissions: getMemberPermissions({
      currentUserRole,
      memberRoleName: member.roleName,
      ownerCount,
    }),
  }))
  return (
    <>
      {isOwner && isRolesError ? (
        <div className='flex items-center justify-between border border-destructive/40 p-3'>
          <p className='text-destructive text-xs' role='alert'>
            Não foi possível carregar os cargos.
          </p>
          <Button onClick={onRetryRoles} size='sm' variant='outline'>
            Recarregar cargos
          </Button>
        </div>
      ) : null}
      <div className='max-h-120 overflow-auto border border-border'>
        <table
          aria-label='Membros e cargos'
          className='w-full table-fixed border-collapse text-left'
        >
          <colgroup>
            <col />
            <col className='w-24 md:w-36' />
            {isOwner ? <col className='w-11 md:w-15' /> : null}
          </colgroup>
          <tbody className='divide-y divide-border'>
            {membersWithPermissions.map(({ member, permissions }, index) => (
              <MemberRow
                index={index}
                isChangingRole={isChangingRole}
                isOwner={isOwner}
                isRolesError={isRolesError}
                isRolesLoading={isRolesLoading}
                key={member.id}
                member={member}
                onChangeRole={onChangeRole}
                permissions={permissions}
                roles={roles}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MemberRow({
  index,
  isOwner,
  member,
  permissions,
  roles,
  isRolesLoading,
  isRolesError,
  isChangingRole,
  onChangeRole,
}: {
  index: number
  isOwner: boolean
  member: WorkspaceMemberResponse
  permissions: MemberPermissions
  roles: WorkspaceRoleResponse[]
  isRolesLoading: boolean
  isRolesError: boolean
  isChangingRole: boolean
  onChangeRole: (member: WorkspaceMemberResponse, roleId: string) => void
}) {
  const { name } = member
  const handleRoleChange = useCallback(
    (roleId: string) => onChangeRole(member, roleId),
    [member, onChangeRole]
  )

  return (
    <tr className={index % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
      <td className='max-w-0 px-2 py-3 md:px-4'>
        <div className='flex items-center gap-3'>
          <span
            aria-hidden='true'
            className='flex size-8 shrink-0 items-center justify-center border border-border bg-muted/30 font-bold font-mono text-primary text-xs uppercase'
          >
            {name.charAt(0)}
          </span>
          <div className='flex min-w-0 flex-1 flex-col'>
            <span className='truncate font-mono font-semibold text-xs uppercase tracking-wide'>
              {name}
            </span>
            {isOwner ? (
              <span className='truncate font-mono text-muted-foreground text-xs'>
                {member.email ?? '—'}
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className='px-1 py-3 md:px-2'>
        {isOwner ? (
          <Select
            disabled={
              isRolesLoading ||
              isRolesError ||
              isChangingRole ||
              roles.length === 0
            }
            onValueChange={handleRoleChange}
            value={member.roleId}
          >
            <SelectTrigger
              aria-label={`Cargo de ${name}`}
              className='w-24 max-w-full border-primary/50 bg-primary/5 font-mono text-primary text-xs uppercase md:w-36'
              title='Alterar cargo.'
            >
              {roles.some((role) => role.id === member.roleId) ? (
                <SelectValue className='truncate' />
              ) : (
                <span className='truncate'>{member.roleName}</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem className='uppercase' key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className='font-mono text-primary text-xs uppercase'>
            {member.roleName}
          </span>
        )}
      </td>
      {isOwner ? (
        <td className='px-2 py-3 text-right md:px-4'>
          <Button
            aria-label={`Remover ${name}`}
            className='size-7 shrink-0 border border-destructive/40 text-destructive hover:bg-destructive/10'
            disabled
            size='icon'
            title={permissions.removeReason ?? 'Remover membro.'}
            variant='outline'
          >
            <TrashIcon aria-hidden='true' className='size-3.5' />
          </Button>
        </td>
      ) : null}
    </tr>
  )
}
