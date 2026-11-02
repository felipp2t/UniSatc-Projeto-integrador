import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { accessGroupApi, sharingApi, workspaceApi } from '@/api/endpoints'
import type { AccessGroupResponse, WorkspaceMemberResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'
import { Field, FieldLabel } from '@/components/ui/field'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appToast } from '@/components/ui/toast'

const workspacePermissionsKey = (workspaceId: string) => [
  'workspace-permissions',
  workspaceId,
]
const sharingOriginsKey = (
  workspaceId: string,
  kind: ShareTarget['kind'],
  id: string
) => ['sharing-origins', workspaceId, kind, id]

export interface ShareTarget {
  id: string
  kind: 'collection' | 'item'
  name: string
}

export function useCanManageSharing(workspaceId: string) {
  const permissions = useQuery({
    queryFn: async () => (await workspaceApi.permissions(workspaceId)).data,
    queryKey: workspacePermissionsKey(workspaceId),
  })
  return Boolean(
    permissions.data?.isOwner ||
      permissions.data?.permissions.some(
        ({ action, resource }) => resource === 'sharing' && action === 'manage'
      )
  )
}

export function ShareAccessDialog({
  onClose,
  open,
  target,
  workspaceId,
}: {
  onClose: () => void
  open: boolean
  target: ShareTarget
  workspaceId: string
}) {
  const permissions = useQuery({
    enabled: open,
    queryFn: async () => (await workspaceApi.permissions(workspaceId)).data,
    queryKey: workspacePermissionsKey(workspaceId),
  })
  const canManage =
    permissions.data?.isOwner ||
    permissions.data?.permissions.some(
      ({ action, resource }) => resource === 'sharing' && action === 'manage'
    )
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose()
    },
    [onClose]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Compartilhar {target.kind === 'collection' ? 'pasta' : 'item'}
          </DialogTitle>
          <DialogDescription>{target.name}</DialogDescription>
        </DialogHeader>
        <ShareAccessContent
          canManage={Boolean(canManage)}
          permissionError={permissions.error}
          permissionPending={permissions.isPending}
          target={target}
          workspaceId={workspaceId}
        />
        <DialogFooter>
          <Button onClick={onClose} variant='outline'>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShareAccessContent({
  canManage,
  permissionError,
  permissionPending,
  target,
  workspaceId,
}: {
  canManage: boolean
  permissionError: Error | null
  permissionPending: boolean
  target: ShareTarget
  workspaceId: string
}) {
  if (permissionPending) return <LoadingState label='Verificando permissão…' />
  if (permissionError) return <ErrorState error={permissionError} />
  if (!canManage) {
    return (
      <p className='text-muted-foreground text-sm'>
        Você não tem permissão para gerenciar o compartilhamento deste conteúdo.
      </p>
    )
  }
  return <SharingConfiguration target={target} workspaceId={workspaceId} />
}

function SharingConfiguration({
  target,
  workspaceId,
}: {
  target: ShareTarget
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const groups = useQuery({
    enabled: target.kind === 'collection',
    queryFn: async () => (await accessGroupApi.list(workspaceId)).data,
    queryKey: ['access-groups', workspaceId],
  })
  const members = useQuery({
    enabled: target.kind === 'item',
    queryFn: async () => (await workspaceApi.listMembers(workspaceId)).data,
    queryKey: ['workspace-members', workspaceId],
  })
  const origins = useQuery({
    queryFn: async () =>
      (await sharingApi.origins(workspaceId, target.kind, target.id)).data,
    queryKey: sharingOriginsKey(workspaceId, target.kind, target.id),
  })
  const run = useCallback(
    async (action: string, operation: () => Promise<unknown>) => {
      setPendingAction(action)
      try {
        await operation()
        await queryClient.invalidateQueries({
          queryKey: sharingOriginsKey(workspaceId, target.kind, target.id),
        })
        appToast.success('Compartilhamento atualizado.')
      } catch {
        appToast.error('Não foi possível atualizar o compartilhamento.')
      } finally {
        setPendingAction('')
      }
    },
    [queryClient, target.id, target.kind, workspaceId]
  )
  const handleGroupChange = useCallback((value: string) => {
    setSelectedGroup(value)
  }, [])
  const handleMemberChange = useCallback((value: string) => {
    setSelectedMember(value)
  }, [])
  const handleGrantEveryone = useCallback(
    () =>
      run('everyone', () => sharingApi.grantEveryone(workspaceId, target.id)),
    [run, target.id, workspaceId]
  )
  const handleRevokeEveryone = useCallback(
    () =>
      run('revoke-everyone', () =>
        sharingApi.revokeEveryone(workspaceId, target.id)
      ),
    [run, target.id, workspaceId]
  )
  const handleSetInheritance = useCallback(
    (enabled: boolean) =>
      run(`inheritance-${enabled}`, () =>
        sharingApi.setInheritance(workspaceId, target.id, enabled)
      ),
    [run, target.id, workspaceId]
  )
  const handleGrantGroup = useCallback(async () => {
    if (!selectedGroup) return
    await run('group', () =>
      sharingApi.grantGroup(workspaceId, target.id, selectedGroup)
    )
    setSelectedGroup('')
  }, [run, selectedGroup, target.id, workspaceId])
  const handleGrantMember = useCallback(async () => {
    if (!selectedMember) return
    await run('member', () =>
      sharingApi.grantMember(workspaceId, target.id, selectedMember)
    )
    setSelectedMember('')
  }, [run, selectedMember, target.id, workspaceId])
  const isPending = pendingAction.length > 0

  return (
    <div className='space-y-5'>
      <SharingControls
        groups={groups.data ?? []}
        inheritedPublicGrant={
          origins.data?.includes('public:workspace-root') ?? false
        }
        isPending={isPending}
        localPublicGrant={
          origins.data?.includes(`public:collection:${target.id}`) ?? false
        }
        members={members.data ?? []}
        onGrantEveryone={handleGrantEveryone}
        onGrantGroup={handleGrantGroup}
        onGrantMember={handleGrantMember}
        onGroupChange={handleGroupChange}
        onMemberChange={handleMemberChange}
        onRevokeEveryone={handleRevokeEveryone}
        onSetInheritance={handleSetInheritance}
        selectedGroup={selectedGroup}
        selectedMember={selectedMember}
        target={target}
      />
      <SharingOriginsState
        error={
          target.kind === 'collection'
            ? (groups.error ?? origins.error)
            : (members.error ?? origins.error)
        }
        groups={groups.data ?? []}
        isPending={
          (target.kind === 'collection'
            ? groups.isPending
            : members.isPending) || origins.isPending
        }
        members={members.data ?? []}
        origins={origins.data ?? []}
        target={target}
      />
    </div>
  )
}

function SharingControls({
  groups,
  inheritedPublicGrant,
  isPending,
  localPublicGrant,
  members,
  onGrantEveryone,
  onGrantGroup,
  onGrantMember,
  onGroupChange,
  onMemberChange,
  onRevokeEveryone,
  onSetInheritance,
  selectedGroup,
  selectedMember,
  target,
}: {
  groups: AccessGroupResponse[]
  inheritedPublicGrant: boolean
  isPending: boolean
  localPublicGrant: boolean
  members: WorkspaceMemberResponse[]
  onGrantEveryone: () => void
  onGrantGroup: () => void
  onGrantMember: () => void
  onGroupChange: (value: string) => void
  onMemberChange: (value: string) => void
  onRevokeEveryone: () => void
  onSetInheritance: (enabled: boolean) => void
  selectedGroup: string
  selectedMember: string
  target: ShareTarget
}) {
  if (target.kind === 'collection') {
    return (
      <CollectionSharingControls
        groups={groups}
        inheritedPublicGrant={inheritedPublicGrant}
        isPending={isPending}
        localPublicGrant={localPublicGrant}
        onGrantEveryone={onGrantEveryone}
        onGrantGroup={onGrantGroup}
        onGroupChange={onGroupChange}
        onRevokeEveryone={onRevokeEveryone}
        onSetInheritance={onSetInheritance}
        selectedGroup={selectedGroup}
      />
    )
  }
  return (
    <ItemSharingControls
      isPending={isPending}
      members={members}
      onGrantMember={onGrantMember}
      onMemberChange={onMemberChange}
      selectedMember={selectedMember}
    />
  )
}

function SharingOriginsState({
  error,
  groups,
  isPending,
  members,
  origins,
  target,
}: {
  error: Error | null
  groups: AccessGroupResponse[]
  isPending: boolean
  members: WorkspaceMemberResponse[]
  origins: string[]
  target: ShareTarget
}) {
  if (error) return <ErrorState error={error} />
  if (isPending) {
    return <LoadingState label='Carregando opções de compartilhamento…' />
  }
  return (
    <SharingOrigins
      groups={groups}
      members={members}
      origins={origins}
      target={target}
    />
  )
}

function CollectionSharingControls({
  groups,
  inheritedPublicGrant,
  isPending,
  localPublicGrant,
  onGroupChange,
  onGrantEveryone,
  onGrantGroup,
  onRevokeEveryone,
  onSetInheritance,
  selectedGroup,
}: {
  groups: AccessGroupResponse[]
  inheritedPublicGrant: boolean
  isPending: boolean
  localPublicGrant: boolean
  onGroupChange: (value: string) => void
  onGrantEveryone: () => void
  onGrantGroup: () => void
  onRevokeEveryone: () => void
  onSetInheritance: (enabled: boolean) => void
  selectedGroup: string
}) {
  const handleStopInheritance = useCallback(
    () => onSetInheritance(false),
    [onSetInheritance]
  )
  const handleResumeInheritance = useCallback(
    () => onSetInheritance(true),
    [onSetInheritance]
  )

  return (
    <>
      <section aria-labelledby='share-groups-heading' className='space-y-2'>
        <h3 className='font-mono text-xs uppercase' id='share-groups-heading'>
          Grupos de acesso
        </h3>
        <Field>
          <FieldLabel htmlFor='sharing-group'>Grupo</FieldLabel>
          <Select onValueChange={onGroupChange} value={selectedGroup}>
            <SelectTrigger id='sharing-group'>
              <SelectValue placeholder='Selecione um grupo' />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          disabled={!selectedGroup || isPending}
          onClick={onGrantGroup}
          size='sm'
        >
          Conceder acesso ao grupo
        </Button>
      </section>
      <section aria-labelledby='share-public-heading' className='space-y-2'>
        <h3 className='font-mono text-xs uppercase' id='share-public-heading'>
          Todos os membros
        </h3>
        <p className='text-muted-foreground text-sm'>
          {inheritedPublicGrant
            ? 'Todos os membros recebem acesso por uma origem acima desta pasta.'
            : localPublicGrant
              ? 'Todos os membros têm acesso concedido diretamente a esta pasta.'
              : 'Conceda acesso a todos os membros do workspace.'}
        </p>
        {localPublicGrant ? (
          <Button
            disabled={isPending}
            onClick={onRevokeEveryone}
            size='sm'
            variant='outline'
          >
            Remover concessão desta pasta
          </Button>
        ) : (
          <Button
            disabled={isPending}
            onClick={onGrantEveryone}
            size='sm'
            variant='outline'
          >
            Conceder acesso a todos
          </Button>
        )}
      </section>
      <section
        aria-labelledby='share-inheritance-heading'
        className='space-y-2'
      >
        <h3
          className='font-mono text-xs uppercase'
          id='share-inheritance-heading'
        >
          Herança de acesso
        </h3>
        <p className='text-muted-foreground text-sm'>
          Interromper copia as concessões atuais do nível acima. Reativar mantém
          concessões locais como acessos adicionais.
        </p>
        <div className='flex flex-wrap gap-2'>
          <Button
            disabled={isPending}
            onClick={handleStopInheritance}
            size='sm'
            variant='outline'
          >
            Interromper herança
          </Button>
          <Button
            disabled={isPending}
            onClick={handleResumeInheritance}
            size='sm'
            variant='outline'
          >
            Reativar herança
          </Button>
        </div>
      </section>
    </>
  )
}

function ItemSharingControls({
  isPending,
  members,
  onGrantMember,
  onMemberChange,
  selectedMember,
}: {
  isPending: boolean
  members: WorkspaceMemberResponse[]
  onGrantMember: () => void
  onMemberChange: (value: string) => void
  selectedMember: string
}) {
  return (
    <section aria-labelledby='share-member-heading' className='space-y-2'>
      <h3 className='font-mono text-xs uppercase' id='share-member-heading'>
        Compartilhar diretamente com integrante
      </h3>
      <Field>
        <FieldLabel htmlFor='sharing-member'>Integrante</FieldLabel>
        <Select onValueChange={onMemberChange} value={selectedMember}>
          <SelectTrigger id='sharing-member'>
            <SelectValue placeholder='Selecione um integrante' />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name} · {member.roleName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button
        disabled={!selectedMember || isPending}
        onClick={onGrantMember}
        size='sm'
      >
        Conceder acesso ao item
      </Button>
    </section>
  )
}

function SharingOrigins({
  groups,
  members,
  origins,
  target,
}: {
  groups: AccessGroupResponse[]
  members: WorkspaceMemberResponse[]
  origins: string[]
  target: ShareTarget
}) {
  const labels = origins.map((origin) => {
    if (origin === 'public:workspace-root') {
      return 'Todos os membros pela raiz do workspace'
    }
    if (origin.startsWith('public:collection:')) {
      return origin === `public:collection:${target.id}`
        ? 'Todos os membros por concessão direta'
        : 'Todos os membros por uma pasta compartilhada'
    }
    if (origin.startsWith('group:')) {
      const id = origin.slice('group:'.length)
      const group = groups.find((entry) => entry.id === id)
      return group ? `Grupo ${group.name}` : 'Grupo de acesso'
    }
    if (origin.startsWith('member:')) {
      const id = origin.slice('member:'.length)
      const member = members.find((entry) => entry.id === id)
      return member ? `Acesso individual: ${member.name}` : 'Acesso individual'
    }
    return 'Origem de acesso'
  })

  return (
    <section aria-labelledby='sharing-origins-heading' className='space-y-2'>
      <h3 className='font-mono text-xs uppercase' id='sharing-origins-heading'>
        Origens de acesso aplicáveis à sua conta
      </h3>
      {labels.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          Nenhuma concessão aplicável foi identificada.
        </p>
      ) : (
        <ul className='list-inside list-disc space-y-1 text-muted-foreground text-sm'>
          {labels.map((label, index) => (
            <li key={`${label}-${index}`}>{label}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
