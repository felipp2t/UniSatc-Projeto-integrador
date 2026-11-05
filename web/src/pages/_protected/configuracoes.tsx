import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { globalRoleApi, workspaceApi } from '@/api/endpoints'
import type { WorkspaceMemberResponse } from '@/api/types'
import {
  workspaceMembersQueryKey,
  workspacesQueryKey,
} from '@/api/workspace-keys'
import { InviteMemberDialog } from '@/components/workspace/invite-member-dialog'
import { PendingInvitesSection } from '@/components/workspace/pending-invites-section'
import { RemoveMemberDialog } from '@/components/workspace/remove-member-dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { appToast } from '@/components/ui/toast'
import { WorkspaceSettingsLayout } from '@/components/workspace/workspace-settings-layout'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useRemoveMember } from '@/hooks/use-remove-member'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export const Route = createFileRoute('/_protected/configuracoes')({
  component: WorkspaceSettingsPage,
  head: () => ({ meta: [{ title: 'Configurações do workspace | Vaulty' }] }),
})

function WorkspaceSettingsPage() {
  const { session } = Route.useRouteContext()
  const [search, setSearch] = useState('')
  const [transferTarget, setTransferTarget] =
    useState<WorkspaceMemberResponse | null>(null)
  const workspaces = useCurrentWorkspace()
  const workspaceId = workspaces.data?.id
  const { members } = useWorkspaceMembers(workspaceId, session.user?.id)
  const permissions = useWorkspacePermissions(workspaceId)
  const queryClient = useQueryClient()
  const removal = useRemoveMember({
    currentUserId: session.user?.id,
    session,
    workspaceId,
  })
  const invalidateWorkspaceData = useCallback(
    async (includeWorkspaces = false) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceMembersQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['workspace-permissions', workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['workspace-teams', workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['workspace-team-members', workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['workspace-root-collections', workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['workspace-received', workspaceId],
        }),
        ...(includeWorkspaces
          ? [queryClient.invalidateQueries({ queryKey: workspacesQueryKey })]
          : []),
      ])
    },
    [queryClient, workspaceId]
  )
  const role = useMutation({
    mutationFn: ({
      member,
      value,
    }: {
      member: WorkspaceMemberResponse
      value: string
    }) => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      const nextRole =
        value === 'NONE' ? null : (value as 'ADMIN' | 'MAINTAINER')
      return globalRoleApi.assign(workspaceId, member.id, nextRole)
    },
    onError: () => appToast.error('Não foi possível atualizar o papel global.'),
    onSuccess: async () => {
      await invalidateWorkspaceData()
      appToast.success('Papel global atualizado.')
    },
  })
  const transfer = useMutation({
    mutationFn: (memberId: string) => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return workspaceApi.transferOwnership(workspaceId, memberId)
    },
    onError: () => appToast.error('Não foi possível transferir a propriedade.'),
    onSuccess: async () => {
      await invalidateWorkspaceData(true)
      appToast.success('Propriedade transferida. Você agora é administrador.')
    },
  })
  const retryMembers = useCallback(async () => {
    await members.refetch()
  }, [members.refetch])
  const handleRoleChange = useCallback(
    (member: WorkspaceMemberResponse, value: string) => {
      role.mutate({ member, value })
    },
    [role.mutate]
  )
  const handleTransfer = useCallback((member: WorkspaceMemberResponse) => {
    setTransferTarget(member)
  }, [])
  const confirmTransfer = useCallback(() => {
    if (!transferTarget) return
    transfer.mutate(transferTarget.id)
    setTransferTarget(null)
  }, [transfer.mutate, transferTarget])
  const handleTransferDialogChange = useCallback((open: boolean) => {
    if (!open) setTransferTarget(null)
  }, [])
  const cancelTransfer = useCallback(() => setTransferTarget(null), [])
  const handleRemove = useCallback(
    (member: WorkspaceMemberResponse) => {
      removal.request(member)
    },
    [removal.request]
  )
  const filtered = useMemo(
    () =>
      (members.data ?? []).filter((member) =>
        member.name
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())
      ),
    [members.data, search]
  )

  if (removal.signedOut) return null
  if (workspaces.isPending)
    return <LoadingState label='Carregando workspace…' />
  if (workspaces.isError)
    return (
      <ErrorState
        error={workspaces.error}
        message='Não foi possível carregar seu workspace.'
        onRetry={workspaces.refetch}
      />
    )
  if (!workspaceId)
    return (
      <main className='container mx-auto px-4 py-8 md:px-8 md:py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar os membros.'
          title='Nenhum workspace disponível'
        />
      </main>
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

  return (
    <WorkspaceSettingsLayout
      breadcrumbLabel='Configurações do workspace'
      canManageGroups={permissions.canManageTeams}
      canManageRoles={permissions.isOwner}
    >
      <section
        aria-label='Configurações do workspace'
        className='min-w-0 flex-1'
      >
        <Tabs defaultValue='members'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <TabsList>
              <TabsTrigger value='members'>
                Membros ({members.data?.length ?? 0})
              </TabsTrigger>
              {permissions.isOwner ? (
                <TabsTrigger value='invites'>Convites</TabsTrigger>
              ) : null}
            </TabsList>
            {permissions.canInvite ? <InviteMemberDialog /> : null}
          </div>
          <TabsContent className='mt-4 space-y-4' value='members'>
            <label className='sr-only' htmlFor='member-search'>
              Buscar membro por nome
            </label>
            <Input
              id='member-search'
              onValueChange={setSearch}
              placeholder='Buscar por nome'
              value={search}
            />
            {members.isPending ? (
              <LoadingState label='Carregando membros…' />
            ) : members.isError ? (
              <ErrorState
                error={members.error}
                message='Não foi possível carregar os membros.'
                onRetry={retryMembers}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                description={
                  search
                    ? 'Ajuste a busca e tente novamente.'
                    : 'Este workspace ainda não tem membros.'
                }
                title='Nenhum membro encontrado'
              />
            ) : (
              <ul
                aria-label='Membros do workspace'
                className='mt-3 divide-y divide-border rounded-md border border-border'
              >
                {filtered.map((member) => (
                  <MemberRow
                    canManageRoles={permissions.isOwner}
                    currentUserId={session.user?.id}
                    isRemoving={removal.isPending}
                    isRolePending={role.isPending}
                    isTransferring={transfer.isPending}
                    key={member.id}
                    member={member}
                    onRemove={handleRemove}
                    onRoleChange={handleRoleChange}
                    onTransfer={handleTransfer}
                  />
                ))}
              </ul>
            )}
          </TabsContent>
          {permissions.isOwner ? (
            <TabsContent className='mt-4' value='invites'>
              <PendingInvitesSection />
            </TabsContent>
          ) : null}
        </Tabs>
      </section>
      <RemoveMemberDialog removal={removal} />
      <TransferOwnershipDialog
        isPending={transfer.isPending}
        onCancel={cancelTransfer}
        onConfirm={confirmTransfer}
        onOpenChange={handleTransferDialogChange}
        target={transferTarget}
      />
    </WorkspaceSettingsLayout>
  )
}

function TransferOwnershipDialog({
  isPending,
  onCancel,
  onConfirm,
  onOpenChange,
  target,
}: {
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  target: WorkspaceMemberResponse | null
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={target !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir propriedade do workspace?</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.name} será o novo dono. Você passará a ser administrador.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCancel} variant='outline'>
            Cancelar
          </Button>
          <Button disabled={isPending} loading={isPending} onClick={onConfirm}>
            Transferir propriedade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({
  canManageRoles,
  currentUserId,
  isRemoving,
  isRolePending,
  isTransferring,
  member,
  onRemove,
  onRoleChange,
  onTransfer,
}: {
  canManageRoles: boolean
  currentUserId: string | undefined
  isRemoving: boolean
  isRolePending: boolean
  isTransferring: boolean
  member: WorkspaceMemberResponse
  onRemove: (member: WorkspaceMemberResponse) => void
  onRoleChange: (member: WorkspaceMemberResponse, value: string) => void
  onTransfer: (member: WorkspaceMemberResponse) => void
}) {
  const handleRoleChange = useCallback(
    (value: string) => onRoleChange(member, value),
    [member, onRoleChange]
  )
  const handleRemove = useCallback(() => onRemove(member), [member, onRemove])
  const handleTransfer = useCallback(
    () => onTransfer(member),
    [member, onTransfer]
  )
  const roleLabel = member.isTeamLeader
    ? 'Líder'
    : member.globalRole === 'MAINTAINER'
      ? 'Maintainer'
      : member.globalRole === 'ADMIN'
        ? 'Admin'
        : (member.roleName ?? 'Sem time/papel')

  return (
    <li className='flex flex-wrap items-center gap-3 p-3'>
      <div className='min-w-0 flex-1'>
        <p className='truncate font-semibold text-sm'>{member.name}</p>
        <p className='text-muted-foreground text-xs'>
          {member.email ?? member.roleName ?? 'Sem time/papel'}
        </p>
      </div>
      <span className='font-mono text-muted-foreground text-xs'>
        {roleLabel}
      </span>
      {canManageRoles && member.userId !== currentUserId ? (
        <>
          <Select
            disabled={isRolePending}
            onValueChange={handleRoleChange}
            value={member.globalRole ?? 'NONE'}
          >
            <SelectTrigger
              aria-label={`Papel global de ${member.name}`}
              className='w-36'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='NONE'>Sem papel global</SelectItem>
              <SelectItem value='ADMIN'>Admin</SelectItem>
              <SelectItem value='MAINTAINER'>Maintainer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            aria-label={`Transferir propriedade para ${member.name}`}
            disabled={isTransferring}
            onClick={handleTransfer}
            size='sm'
            variant='outline'
          >
            Transferir propriedade
          </Button>
          <Button
            aria-label={`Remover ${member.name} do workspace`}
            disabled={isRemoving}
            onClick={handleRemove}
            size='sm'
            variant='outline'
          >
            Remover
          </Button>
        </>
      ) : null}
    </li>
  )
}
