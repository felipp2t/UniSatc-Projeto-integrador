import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { sharingApi } from '@/api/endpoints'
import type { AccessGroupResponse } from '@/api/types'
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
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

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
  const permissions = useWorkspacePermissions(open ? workspaceId : undefined)
  const canManage = permissions.can('sharing', 'manage')
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
  const permissions = useWorkspacePermissions(workspaceId)
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedOriginsMemberId, setSelectedOriginsMemberId] =
    useState<string>()
  const [pendingAction, setPendingAction] = useState('')
  const collectionConfiguration = useQuery({
    enabled:
      target.kind === 'collection' && permissions.can('sharing', 'manage'),
    queryFn: async () =>
      (await sharingApi.collectionConfiguration(workspaceId, target.id)).data,
    queryKey: ['sharing-configuration', workspaceId, 'collection', target.id],
  })
  const itemConfiguration = useQuery({
    enabled: target.kind === 'item' && permissions.can('sharing', 'manage'),
    queryFn: async () =>
      (await sharingApi.itemConfiguration(workspaceId, target.id)).data,
    queryKey: ['sharing-configuration', workspaceId, 'item', target.id],
  })
  const origins = useQuery({
    queryFn: async () =>
      (
        await sharingApi.origins(
          workspaceId,
          target.kind,
          target.id,
          target.kind === 'item' ? selectedOriginsMemberId : undefined
        )
      ).data,
    queryKey: [
      ...sharingOriginsKey(workspaceId, target.kind, target.id),
      selectedOriginsMemberId,
    ],
  })
  const run = useCallback(
    async (action: string, operation: () => Promise<unknown>) => {
      setPendingAction(action)
      try {
        await operation()
        await queryClient.invalidateQueries({
          queryKey: sharingOriginsKey(workspaceId, target.kind, target.id),
        })
        await queryClient.invalidateQueries({
          queryKey: [
            'sharing-configuration',
            workspaceId,
            target.kind,
            target.id,
          ],
        })
        appToast.success('Compartilhamento atualizado.')
        return true
      } catch {
        appToast.error('Não foi possível atualizar o compartilhamento.')
        return false
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
  const handleRevokeGroup = useCallback(
    (groupId: string) =>
      run(`revoke-group-${groupId}`, () =>
        sharingApi.revokeGroup(workspaceId, target.id, groupId)
      ),
    [run, target.id, workspaceId]
  )
  const handleRevokeMember = useCallback(
    async (memberId: string) => {
      const succeeded = await run(`revoke-member-${memberId}`, () =>
        sharingApi.revokeMember(workspaceId, target.id, memberId)
      )
      if (succeeded) setSelectedOriginsMemberId(memberId)
    },
    [run, target.id, workspaceId]
  )
  const handleShowCurrentUserOrigins = useCallback(() => {
    setSelectedOriginsMemberId(undefined)
  }, [])
  const isPending = pendingAction.length > 0
  const groups =
    target.kind === 'collection'
      ? (collectionConfiguration.data?.groups ?? [])
      : []
  const grantedGroups =
    target.kind === 'collection'
      ? (collectionConfiguration.data?.grantedGroups ?? [])
      : []
  const inheritAccess =
    target.kind === 'collection'
      ? (collectionConfiguration.data?.inheritAccess ?? true)
      : true
  const publicGrant =
    target.kind === 'collection'
      ? (collectionConfiguration.data?.publicGrant ?? false)
      : false
  const members =
    target.kind === 'item'
      ? (itemConfiguration.data?.eligibleMembers ?? [])
      : []
  const grantedMembers =
    target.kind === 'item' ? (itemConfiguration.data?.grantedMembers ?? []) : []
  const configurationError =
    target.kind === 'collection'
      ? collectionConfiguration.error
      : itemConfiguration.error
  const configurationFetching =
    target.kind === 'collection'
      ? collectionConfiguration.isFetching
      : itemConfiguration.isFetching
  const configurationLoaded =
    target.kind === 'collection'
      ? collectionConfiguration.isSuccess
      : itemConfiguration.isSuccess

  return (
    <div className='space-y-5'>
      <SharingConfigurationGate
        error={configurationError}
        loaded={configurationLoaded}
      >
        <SharingControls
          grantedGroups={grantedGroups}
          grantedMembers={grantedMembers}
          groups={groups}
          inheritanceEnabled={inheritAccess}
          isPending={isPending}
          localPublicGrant={publicGrant}
          members={members}
          onGrantEveryone={handleGrantEveryone}
          onGrantGroup={handleGrantGroup}
          onGrantMember={handleGrantMember}
          onGroupChange={handleGroupChange}
          onMemberChange={handleMemberChange}
          onRevokeEveryone={handleRevokeEveryone}
          onRevokeGroup={handleRevokeGroup}
          onRevokeMember={handleRevokeMember}
          onSetInheritance={handleSetInheritance}
          selectedGroup={selectedGroup}
          selectedMember={selectedMember}
          target={target}
        />
      </SharingConfigurationGate>
      <SharingOriginsState
        error={origins.error}
        groups={groups}
        isPending={configurationFetching || origins.isPending}
        members={members}
        onShowCurrentUser={handleShowCurrentUserOrigins}
        origins={origins.data ?? []}
        selectedMemberId={selectedOriginsMemberId}
        target={target}
      />
    </div>
  )
}

function SharingConfigurationGate({
  children,
  error,
  loaded,
}: {
  children: ReactNode
  error: Error | null
  loaded: boolean
}) {
  if (error) return <ErrorState error={error} />
  if (!loaded) {
    return (
      <LoadingState label='Carregando configurações de compartilhamento…' />
    )
  }
  return children
}

function SharingControls({
  groups,
  grantedGroups,
  grantedMembers,
  inheritanceEnabled,
  isPending,
  localPublicGrant,
  members,
  onGrantEveryone,
  onGrantGroup,
  onGrantMember,
  onGroupChange,
  onMemberChange,
  onRevokeEveryone,
  onRevokeGroup,
  onRevokeMember,
  onSetInheritance,
  selectedGroup,
  selectedMember,
  target,
}: {
  groups: AccessGroupResponse[]
  grantedGroups: AccessGroupResponse[]
  grantedMembers: { id: string; name: string }[]
  inheritanceEnabled: boolean
  isPending: boolean
  localPublicGrant: boolean
  members: { id: string; name: string }[]
  onGrantEveryone: () => void
  onGrantGroup: () => void
  onGrantMember: () => void
  onGroupChange: (value: string) => void
  onMemberChange: (value: string) => void
  onRevokeEveryone: () => void
  onRevokeGroup: (id: string) => void
  onRevokeMember: (id: string) => void
  onSetInheritance: (enabled: boolean) => void
  selectedGroup: string
  selectedMember: string
  target: ShareTarget
}) {
  if (target.kind === 'collection') {
    return (
      <CollectionSharingControls
        grantedGroups={grantedGroups}
        groups={groups}
        inheritanceEnabled={inheritanceEnabled}
        isPending={isPending}
        localPublicGrant={localPublicGrant}
        onGrantEveryone={onGrantEveryone}
        onGrantGroup={onGrantGroup}
        onGroupChange={onGroupChange}
        onRevokeEveryone={onRevokeEveryone}
        onRevokeGroup={onRevokeGroup}
        onSetInheritance={onSetInheritance}
        selectedGroup={selectedGroup}
      />
    )
  }
  return (
    <ItemSharingControls
      grantedMembers={grantedMembers}
      isPending={isPending}
      members={members}
      onGrantMember={onGrantMember}
      onMemberChange={onMemberChange}
      onRevokeMember={onRevokeMember}
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
  onShowCurrentUser,
  selectedMemberId,
  target,
}: {
  error: Error | null
  groups: AccessGroupResponse[]
  isPending: boolean
  members: { id: string; name: string }[]
  origins: string[]
  onShowCurrentUser: () => void
  selectedMemberId?: string
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
      onShowCurrentUser={onShowCurrentUser}
      origins={origins}
      selectedMemberId={selectedMemberId}
      target={target}
    />
  )
}

function CollectionSharingControls({
  groups,
  grantedGroups,
  inheritanceEnabled,
  isPending,
  localPublicGrant,
  onGroupChange,
  onGrantEveryone,
  onGrantGroup,
  onRevokeEveryone,
  onRevokeGroup,
  onSetInheritance,
  selectedGroup,
}: {
  groups: AccessGroupResponse[]
  grantedGroups: AccessGroupResponse[]
  inheritanceEnabled: boolean
  isPending: boolean
  localPublicGrant: boolean
  onGroupChange: (value: string) => void
  onGrantEveryone: () => void
  onGrantGroup: () => void
  onRevokeEveryone: () => void
  onRevokeGroup: (id: string) => void
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
      {groups.length > 0 ? (
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
      ) : null}
      <section aria-labelledby='share-public-heading' className='space-y-2'>
        <h3 className='font-mono text-xs uppercase' id='share-public-heading'>
          Todos os membros
        </h3>
        <p className='text-muted-foreground text-sm'>
          {localPublicGrant
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
      {grantedGroups.length > 0 ? (
        <section
          aria-labelledby='share-existing-groups-heading'
          className='space-y-2'
        >
          <h3
            className='font-mono text-xs uppercase'
            id='share-existing-groups-heading'
          >
            Grupos com acesso direto
          </h3>
          <ul className='space-y-1 text-sm'>
            {grantedGroups.map((group) => (
              <li
                className='flex items-center justify-between gap-2'
                key={group.id}
              >
                <span>{group.name}</span>
                <SharingRevokeButton
                  disabled={isPending}
                  id={group.id}
                  name={group.name}
                  onRevoke={onRevokeGroup}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
          {inheritanceEnabled
            ? 'A herança está ativa. Interromper copia as concessões atuais do nível acima.'
            : 'A herança está interrompida. Reativar mantém concessões locais como acessos adicionais.'}
        </p>
        <div className='flex flex-wrap gap-2'>
          <Button
            disabled={isPending || !inheritanceEnabled}
            onClick={handleStopInheritance}
            size='sm'
            variant='outline'
          >
            Interromper herança
          </Button>
          <Button
            disabled={isPending || inheritanceEnabled}
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
  grantedMembers,
  isPending,
  members,
  onGrantMember,
  onMemberChange,
  onRevokeMember,
  selectedMember,
}: {
  isPending: boolean
  grantedMembers: { id: string; name: string }[]
  members: { id: string; name: string }[]
  onGrantMember: () => void
  onMemberChange: (value: string) => void
  onRevokeMember: (id: string) => void
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
                {member.name}
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
      {grantedMembers.length > 0 ? (
        <section
          aria-label='Integrantes com acesso direto'
          className='space-y-2'
        >
          <h4 className='font-mono text-xs uppercase'>Acesso direto</h4>
          <ul className='space-y-1 text-sm'>
            {grantedMembers.map((member) => (
              <li
                className='flex items-center justify-between gap-2'
                key={member.id}
              >
                <span>{member.name}</span>
                <SharingRevokeButton
                  disabled={isPending}
                  id={member.id}
                  name={member.name}
                  onRevoke={onRevokeMember}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}

function SharingRevokeButton({
  disabled,
  id,
  name,
  onRevoke,
}: {
  disabled: boolean
  id: string
  name: string
  onRevoke: (id: string) => void
}) {
  const handleClick = useCallback(() => onRevoke(id), [id, onRevoke])
  return (
    <Button
      aria-label={`Remover acesso de ${name}`}
      disabled={disabled}
      onClick={handleClick}
      size='sm'
      variant='outline'
    >
      Remover
    </Button>
  )
}

function SharingOrigins({
  groups,
  members,
  origins,
  onShowCurrentUser,
  selectedMemberId,
  target,
}: {
  groups: AccessGroupResponse[]
  members: { id: string; name: string }[]
  origins: string[]
  onShowCurrentUser: () => void
  selectedMemberId?: string
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
  const selectedMember = members.find(
    (member) => member.id === selectedMemberId
  )

  return (
    <section aria-labelledby='sharing-origins-heading' className='space-y-2'>
      <h3 className='font-mono text-xs uppercase' id='sharing-origins-heading'>
        {selectedMember
          ? `Origens de acesso aplicáveis a ${selectedMember.name}`
          : 'Origens de acesso aplicáveis à sua conta'}
      </h3>
      {selectedMember ? (
        <Button onClick={onShowCurrentUser} size='sm' variant='outline'>
          Ver minhas origens
        </Button>
      ) : null}
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
