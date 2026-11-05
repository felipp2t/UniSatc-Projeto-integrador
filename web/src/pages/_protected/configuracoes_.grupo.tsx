import {
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ComponentProps } from 'react'
import { useCallback, useState } from 'react'
import { collectionsApi, workspaceTeamsApi } from '@/api/endpoints'
import type {
  CollectionResponse,
  TeamResponse,
  WorkspaceMemberResponse,
} from '@/api/types'
import {
  workspaceMembersQueryKey,
  workspaceTeamMembersQueryKey,
  workspaceTeamsQueryKey,
} from '@/api/workspace-keys'
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
import { appToast } from '@/components/ui/toast'
import { WorkspaceSettingsLayout } from '@/components/workspace-settings-layout'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export const Route = createFileRoute(
  '/_protected/configuracoes_/grupo'
)({
  component: TeamsPage,
  head: () => ({
    meta: [{ title: 'Times | Configurações do workspace | Vaulty' }],
  }),
})

function TeamsPage() {
  const { session } = Route.useRouteContext()
  const workspace = useCurrentWorkspace()
  const workspaceId = workspace.data?.id
  const ownerId = workspace.data?.ownerId
  const permissions = useWorkspacePermissions(workspaceId)
  const queryClient = useQueryClient()
  const { members } = useWorkspaceMembers(workspaceId, session.user?.id)
  const [selectedId, setSelectedId] = useState<string>()
  const [name, setName] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [rootCollectionId, setRootCollectionId] = useState('automatic')
  const collections = useQuery({
    enabled: Boolean(workspaceId && permissions.canManageTeams),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      const firstPage = await collectionsApi.list(
        workspaceId,
        undefined,
        0,
        100
      )
      const pages = await Promise.all(
        Array.from(
          { length: Math.max(0, firstPage.data.totalPages - 1) },
          (_, index) =>
            collectionsApi.list(workspaceId, undefined, index + 1, 100)
        )
      )
      return [firstPage, ...pages].flatMap((page) => page.data.items)
    },
    queryKey: ['workspace-root-collections', workspaceId],
  })
  const teams = useQuery({
    enabled: Boolean(workspaceId && permissions.canManageTeams),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceTeamsApi.list(workspaceId)).data
    },
    queryKey: workspaceTeamsQueryKey(workspaceId),
  })
  const selected =
    teams.data?.find((team) => team.id === selectedId) ?? teams.data?.[0]
  const teamMembers = useQuery({
    enabled: Boolean(workspaceId && selected),
    queryFn: async () => {
      if (!(workspaceId && selected)) throw new Error('Time indisponível.')
      return (await workspaceTeamsApi.listMembers(workspaceId, selected.id))
        .data
    },
    queryKey: workspaceTeamMembersQueryKey(workspaceId, selected?.id),
  })
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: workspaceTeamsQueryKey(workspaceId),
    })
    await queryClient.invalidateQueries({
      queryKey: workspaceTeamMembersQueryKey(workspaceId, selected?.id),
    })
    await queryClient.invalidateQueries({
      queryKey: workspaceMembersQueryKey(workspaceId),
    })
    await queryClient.invalidateQueries({
      queryKey: ['workspace-permissions', workspaceId],
    })
  }, [queryClient, selected?.id, workspaceId])
  const createTeam = useMutation({
    mutationFn: () => {
      if (!(workspaceId && name.trim() && leaderId))
        throw new Error('Informe nome e líder do time.')
      return workspaceTeamsApi.create(workspaceId, {
        leaderMemberId: leaderId,
        name: name.trim(),
        rootCollectionId:
          rootCollectionId === 'automatic' ? undefined : rootCollectionId,
      })
    },
    onError: () => appToast.error('Não foi possível criar o time.'),
    onSuccess: async (team) => {
      await refresh()
      setName('')
      setLeaderId('')
      setRootCollectionId('automatic')
      setSelectedId(team.data.id)
      await collections.refetch()
      appToast.success(`Time ${team.data.name} criado.`)
    },
  })
  const addMember = useMutation({
    mutationFn: (memberId: string) =>
      workspaceTeamsApi.addMember(workspaceId!, selected!.id, memberId),
    onError: () =>
      appToast.error('Não foi possível adicionar a pessoa ao time.'),
    onSuccess: refresh,
  })
  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      workspaceTeamsApi.removeMember(workspaceId!, selected!.id, memberId),
    onError: () => appToast.error('Não foi possível remover a pessoa do time.'),
    onSuccess: refresh,
  })
  const transfer = useMutation({
    mutationFn: (memberId: string) =>
      workspaceTeamsApi.transferLeader(workspaceId!, selected!.id, memberId),
    onError: () => appToast.error('Não foi possível transferir a liderança.'),
    onSuccess: refresh,
  })
  const rename = useMutation({
    mutationFn: (value: string) =>
      workspaceTeamsApi.rename(workspaceId!, selected!.id, value),
    onError: () => appToast.error('Não foi possível renomear o time.'),
    onSuccess: refresh,
  })
  const removeTeam = useMutation({
    mutationFn: () => workspaceTeamsApi.delete(workspaceId!, selected!.id),
    onError: () => appToast.error('Não foi possível excluir o time.'),
    onSuccess: async () => {
      setSelectedId(undefined)
      await refresh()
      document.getElementById('teams-title')?.focus()
    },
  })
  const handleCreateSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      createTeam.mutate()
    },
    [createTeam.mutate]
  )
  const handleSelectTeam = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { teamId } = event.currentTarget.dataset
      if (teamId) setSelectedId(teamId)
    },
    []
  )

  const pageState = getTeamsPageState(
    workspace,
    workspaceId,
    permissions,
    teams
  )
  if (pageState) return pageState

  const mayManageAll = permissions.isOwner || permissions.isAdmin
  const teamList = teams.data ?? []
  const attachedCollections = new Set(
    teamList.map((team) => team.rootCollectionId)
  )
  const orphanCollections = (collections.data ?? []).filter(
    (collection) =>
      !(collection.parentId || attachedCollections.has(collection.id))
  )
  const createCandidates =
    members.data?.filter(
      (member) =>
        !(member.globalRole || member.isTeamLeader || member.teamId) &&
        member.userId !== ownerId
    ) ?? []
  return (
    <WorkspaceSettingsLayout
      breadcrumbLabel='Times'
      breadcrumbParentLabel='Configurações do workspace'
      canManageGroups={permissions.canManageTeams}
      canManageRoles={permissions.isOwner}
    >
      <section
        aria-labelledby='teams-title'
        className='min-w-0 flex-1 space-y-5'
      >
        <header>
          <h2
            className='font-mono font-semibold text-sm uppercase tracking-wide'
            id='teams-title'
            tabIndex={-1}
          >
            Times
          </h2>
          <p className='mt-1 max-w-2xl text-muted-foreground text-sm'>
            Cada time tem uma coleção própria, um líder e integrantes. Remover
            um time preserva sua coleção.
          </p>
        </header>
        <TeamDataNotices
          collectionsError={collections.error}
          collectionsLoading={collections.isPending}
          mayManageAll={mayManageAll}
          membersError={members.error}
          membersLoading={members.isPending}
          onRetryCollections={collections.refetch}
          onRetryMembers={members.refetch}
        />
        {mayManageAll ? (
          <TeamCreationForm
            candidates={createCandidates}
            collections={orphanCollections}
            collectionsError={collections.isError}
            collectionsLoading={collections.isPending}
            isPending={createTeam.isPending}
            leaderId={leaderId}
            membersError={members.isError}
            membersLoading={members.isPending}
            name={name}
            onLeaderChange={setLeaderId}
            onNameChange={setName}
            onRootCollectionChange={setRootCollectionId}
            onSubmit={handleCreateSubmit}
            rootCollectionId={rootCollectionId}
          />
        ) : null}
        <TeamDirectory
          busy={
            addMember.isPending ||
            removeMember.isPending ||
            transfer.isPending ||
            rename.isPending ||
            removeTeam.isPending
          }
          error={teamMembers.error}
          loading={teamMembers.isPending}
          mayManageAll={mayManageAll}
          members={members.data ?? []}
          onAdd={addMember.mutate}
          onDelete={removeTeam.mutateAsync}
          onRemove={removeMember.mutateAsync}
          onRename={rename.mutate}
          onRetry={teamMembers.refetch}
          onSelect={handleSelectTeam}
          onTransfer={transfer.mutateAsync}
          ownerId={ownerId}
          selected={selected}
          teamMembers={teamMembers.data ?? []}
          teams={teamList}
        />
      </section>
    </WorkspaceSettingsLayout>
  )
}

function TeamDataNotices({
  collectionsError,
  collectionsLoading,
  membersError,
  membersLoading,
  mayManageAll,
  onRetryCollections,
  onRetryMembers,
}: {
  collectionsError: unknown
  collectionsLoading: boolean
  membersError: unknown
  membersLoading: boolean
  mayManageAll: boolean
  onRetryCollections: () => Promise<unknown>
  onRetryMembers: () => Promise<unknown>
}) {
  if (!mayManageAll) return null
  return (
    <>
      {collectionsLoading ? (
        <LoadingState label='Carregando coleções raiz…' />
      ) : collectionsError ? (
        <ErrorState
          error={collectionsError}
          message='Não foi possível carregar as coleções raiz disponíveis.'
          onRetry={onRetryCollections}
          variant='compact'
        />
      ) : null}
      {membersLoading ? (
        <LoadingState label='Carregando membros para os times…' />
      ) : membersError ? (
        <ErrorState
          error={membersError}
          message='Não foi possível carregar os membros para criar ou atualizar times.'
          onRetry={onRetryMembers}
          variant='compact'
        />
      ) : null}
    </>
  )
}

function getTeamsPageState(
  workspace: ReturnType<typeof useCurrentWorkspace>,
  workspaceId: string | undefined,
  permissions: ReturnType<typeof useWorkspacePermissions>,
  teams: UseQueryResult<TeamResponse[], Error>
) {
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
        description='Você precisa estar vinculado a um workspace para gerenciar times.'
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
  if (!permissions.canManageTeams)
    return <ErrorState message='Você não tem permissão para gerenciar times.' />
  if (teams.isPending) return <LoadingState label='Carregando times…' />
  if (teams.isError)
    return (
      <ErrorState
        error={teams.error}
        message='Não foi possível carregar os times.'
        onRetry={teams.refetch}
      />
    )
  return null
}

function TeamDetails({
  team,
  members,
  teamMembers,
  loading,
  error,
  onRetry,
  mayManageAll,
  onAdd,
  onRemove,
  onTransfer,
  onRename,
  onDelete,
  busy,
  ownerId,
}: {
  team: TeamResponse
  members: import('@/api/types').WorkspaceMemberResponse[]
  teamMembers: import('@/api/types').TeamMemberResponse[]
  loading: boolean
  error: unknown
  onRetry: () => Promise<unknown>
  mayManageAll: boolean
  onAdd: (id: string) => void
  onRemove: (id: string) => Promise<unknown>
  onTransfer: (id: string) => Promise<unknown>
  onRename: (name: string) => void
  onDelete: () => Promise<unknown>
  busy: boolean
  ownerId: string | undefined
}) {
  const [candidateId, setCandidateId] = useState('')
  const [newName, setNewName] = useState(team.name)
  const [confirmation, setConfirmation] = useState<{
    action: 'delete-team' | 'remove-member' | 'transfer-leader'
    memberId?: string
    memberName?: string
  } | null>(null)
  const [shouldFocusTeamsHeading, setShouldFocusTeamsHeading] = useState(false)
  const [confirmationError, setConfirmationError] = useState('')
  const teamIds = new Set(teamMembers.map((member) => member.id))
  const available = members.filter(
    (member) =>
      !(member.globalRole || member.isTeamLeader || teamIds.has(member.id)) &&
      member.userId !== ownerId &&
      (mayManageAll || !member.teamId)
  )
  const canManage =
    mayManageAll ||
    members.some(
      (member) => member.id === team.leaderMemberId && member.isTeamLeader
    )
  const handleRename = useCallback(
    () => onRename(newName.trim()),
    [newName, onRename]
  )
  const handleTransfer = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const memberId = event.currentTarget.value
      const member = teamMembers.find((candidate) => candidate.id === memberId)
      if (member)
        setConfirmation({
          action: 'transfer-leader',
          memberId,
          memberName: member.name,
        })
    },
    [teamMembers]
  )
  const handleRemove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const memberId = event.currentTarget.value
      const member = teamMembers.find((candidate) => candidate.id === memberId)
      if (member)
        setConfirmation({
          action: 'remove-member',
          memberId,
          memberName: member.name,
        })
    },
    [teamMembers]
  )
  const handleAdd = useCallback(() => {
    onAdd(candidateId)
    setCandidateId('')
  }, [candidateId, onAdd])
  const openDeleteConfirmation = useCallback(
    () => setConfirmation({ action: 'delete-team' }),
    []
  )
  const handleConfirmationChange = useCallback(
    (open: boolean) => {
      if (!(open || busy)) setConfirmation(null)
    },
    [busy]
  )
  const cancelConfirmation = useCallback(() => setConfirmation(null), [])
  const confirmAction = useCallback(async () => {
    setConfirmationError('')
    try {
      await runTeamConfirmation(confirmation, onDelete, onRemove, onTransfer)
      if (confirmation?.action !== 'delete-team')
        setShouldFocusTeamsHeading(true)
      setConfirmation(null)
    } catch {
      setConfirmationError(
        'Não foi possível concluir a alteração. Tente novamente.'
      )
    }
  }, [confirmation, onDelete, onRemove, onTransfer])
  const handleCloseAutoFocus = useCallback<
    NonNullable<ComponentProps<typeof DialogContent>['onCloseAutoFocus']>
  >(
    (event) => {
      if (!shouldFocusTeamsHeading) return
      event.preventDefault()
      setShouldFocusTeamsHeading(false)
      document.getElementById('teams-title')?.focus()
    },
    [shouldFocusTeamsHeading]
  )
  const confirmationText = getTeamConfirmationText(confirmation, team.name)
  return (
    <section
      aria-labelledby='team-members-title'
      className='min-w-0 space-y-4 rounded-md border border-border p-4'
    >
      <div>
        <h3
          className='break-words font-semibold text-base'
          id='team-members-title'
        >
          {team.name}
        </h3>
        <p className='mt-1 text-muted-foreground text-sm'>
          Coleção: {team.rootCollectionName}
        </p>
      </div>
      {mayManageAll ? (
        <div className='flex flex-col gap-2 sm:flex-row'>
          <label className='sr-only' htmlFor='rename-team'>
            Nome do time
          </label>
          <Input id='rename-team' onValueChange={setNewName} value={newName} />
          <Button
            disabled={busy || !newName.trim() || newName === team.name}
            onClick={handleRename}
            variant='outline'
          >
            Renomear
          </Button>
          <Button
            disabled={busy}
            onClick={openDeleteConfirmation}
            variant='outline'
          >
            Excluir time
          </Button>
        </div>
      ) : null}
      {loading ? (
        <LoadingState label='Carregando integrantes…' />
      ) : error ? (
        <ErrorState
          error={error}
          message='Não foi possível carregar os integrantes do time.'
          onRetry={onRetry}
        />
      ) : (
        <ul className='divide-y divide-border rounded-md border border-border'>
          {teamMembers.map((member) => (
            <li
              className='flex flex-wrap items-center gap-2 p-3'
              key={member.id}
            >
              <span className='min-w-0 flex-1 font-medium text-sm'>
                {member.name}
                {member.id === team.leaderMemberId ? ' · Líder' : ''}
              </span>
              {canManage && member.id !== team.leaderMemberId ? (
                <>
                  <Button
                    aria-label={`Tornar ${member.name} líder de ${team.name}`}
                    disabled={busy}
                    onClick={handleTransfer}
                    size='sm'
                    value={member.id}
                    variant='outline'
                  >
                    Tornar líder
                  </Button>
                  <Button
                    aria-label={`Remover ${member.name} do time ${team.name}`}
                    disabled={busy}
                    onClick={handleRemove}
                    size='sm'
                    value={member.id}
                    variant='outline'
                  >
                    Remover
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <div className='flex flex-col gap-2 sm:flex-row'>
          <label className='sr-only' htmlFor='add-team-member'>
            Adicionar ou mover integrante
          </label>
          <Select
            disabled={loading || Boolean(error) || available.length === 0}
            onValueChange={setCandidateId}
            value={candidateId}
          >
            <SelectTrigger id='add-team-member'>
              <SelectValue
                placeholder={
                  available.length
                    ? 'Selecione uma pessoa'
                    : 'Sem pessoas disponíveis'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {loading ? (
                <SelectItem disabled value='loading'>
                  Carregando membros…
                </SelectItem>
              ) : error ? (
                <SelectItem disabled value='error'>
                  Não foi possível carregar membros
                </SelectItem>
              ) : available.length === 0 ? (
                <SelectItem disabled value='empty'>
                  Nenhuma pessoa disponível
                </SelectItem>
              ) : null}
              {available.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                  {member.teamId ? ' · mover de outro time' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={busy || !candidateId} onClick={handleAdd}>
            Adicionar ou mover integrante
          </Button>
        </div>
      ) : null}
      <Dialog
        onOpenChange={handleConfirmationChange}
        open={confirmation !== null}
      >
        <DialogContent onCloseAutoFocus={handleCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>Confirmar alteração no time?</DialogTitle>
            <DialogDescription>{confirmationText}</DialogDescription>
            <ConfirmationError message={confirmationError} />
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={cancelConfirmation}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              disabled={busy}
              onClick={confirmAction}
              variant='destructive'
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

async function runTeamConfirmation(
  confirmation: {
    action: 'delete-team' | 'remove-member' | 'transfer-leader'
    memberId?: string
  } | null,
  onDelete: () => Promise<unknown>,
  onRemove: (id: string) => Promise<unknown>,
  onTransfer: (id: string) => Promise<unknown>
) {
  if (confirmation?.action === 'delete-team') await onDelete()
  if (confirmation?.action === 'remove-member' && confirmation.memberId)
    await onRemove(confirmation.memberId)
  if (confirmation?.action === 'transfer-leader' && confirmation.memberId)
    await onTransfer(confirmation.memberId)
}

function getTeamConfirmationText(
  confirmation: {
    action: 'delete-team' | 'remove-member' | 'transfer-leader'
    memberName?: string
  } | null,
  teamName: string
) {
  if (!confirmation) return ''
  if (confirmation.action === 'delete-team')
    return `Excluir ${teamName} remove as associações de integrantes e preserva a coleção do time.`
  if (confirmation.action === 'remove-member')
    return `Remover ${confirmation.memberName} deste time. A pessoa continuará no workspace.`
  return `${confirmation.memberName} passará a liderar ${teamName}.`
}

function ConfirmationError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className='text-destructive text-sm' role='alert'>
      {message}
    </p>
  )
}

function TeamCreationForm({
  candidates,
  collections,
  collectionsError,
  collectionsLoading,
  isPending,
  membersError,
  membersLoading,
  name,
  onLeaderChange,
  onNameChange,
  onRootCollectionChange,
  onSubmit,
  rootCollectionId,
  leaderId,
}: {
  candidates: WorkspaceMemberResponse[]
  collections: CollectionResponse[]
  collectionsError: boolean
  collectionsLoading: boolean
  isPending: boolean
  membersError: boolean
  membersLoading: boolean
  name: string
  onLeaderChange: (id: string) => void
  onNameChange: (name: string) => void
  onRootCollectionChange: (id: string) => void
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void
  rootCollectionId: string
  leaderId: string
}) {
  return (
    <form
      className='flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-end'
      onSubmit={onSubmit}
    >
      <div className='min-w-0 flex-1'>
        <label className='mb-1 block text-xs' htmlFor='new-team-name'>
          Nome do time
        </label>
        <Input
          aria-describedby='new-team-name-help'
          id='new-team-name'
          onValueChange={onNameChange}
          required
          value={name}
        />
        <span className='sr-only' id='new-team-name-help'>
          Obrigatório.
        </span>
      </div>
      <div className='min-w-0 flex-1'>
        <label className='mb-1 block text-xs' htmlFor='new-team-leader'>
          Líder inicial
        </label>
        <Select onValueChange={onLeaderChange} value={leaderId}>
          <SelectTrigger
            aria-describedby='new-team-leader-help'
            disabled={membersLoading || membersError || candidates.length === 0}
            id='new-team-leader'
          >
            <SelectValue placeholder='Selecione uma pessoa' />
          </SelectTrigger>
          <SelectContent>
            {membersLoading ? (
              <SelectItem disabled value='loading'>
                Carregando membros…
              </SelectItem>
            ) : membersError ? (
              <SelectItem disabled value='error'>
                Não foi possível carregar membros
              </SelectItem>
            ) : candidates.length === 0 ? (
              <SelectItem disabled value='empty'>
                Nenhum membro disponível
              </SelectItem>
            ) : null}
            {candidates.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className='sr-only' id='new-team-leader-help'>
          Obrigatório. Selecione um membro sem time ou papel global.
        </span>
      </div>
      <div className='min-w-0 flex-1'>
        <label className='mb-1 block text-xs' htmlFor='new-team-collection'>
          Coleção raiz
        </label>
        <Select
          disabled={collectionsLoading || collectionsError}
          onValueChange={onRootCollectionChange}
          value={rootCollectionId}
        >
          <SelectTrigger id='new-team-collection'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {collectionsLoading ? (
              <SelectItem disabled value='loading'>
                Carregando coleções…
              </SelectItem>
            ) : collectionsError ? (
              <SelectItem disabled value='error'>
                Não foi possível carregar coleções
              </SelectItem>
            ) : null}
            <SelectItem value='automatic'>Criar coleção do time</SelectItem>
            {collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={!(name.trim() && leaderId) || isPending}
        loading={isPending}
        type='submit'
      >
        Criar time
      </Button>
    </form>
  )
}

function TeamDirectory({
  busy,
  error,
  loading,
  mayManageAll,
  members,
  onAdd,
  onDelete,
  onRemove,
  onRename,
  onRetry,
  onSelect,
  onTransfer,
  ownerId,
  selected,
  teams,
  teamMembers,
}: {
  busy: boolean
  error: unknown
  loading: boolean
  mayManageAll: boolean
  members: WorkspaceMemberResponse[]
  onAdd: (id: string) => void
  onDelete: () => Promise<unknown>
  onRemove: (id: string) => Promise<unknown>
  onRename: (name: string) => void
  onRetry: () => Promise<unknown>
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void
  onTransfer: (id: string) => Promise<unknown>
  ownerId: string | undefined
  selected: TeamResponse | undefined
  teams: TeamResponse[]
  teamMembers: import('@/api/types').TeamMemberResponse[]
}) {
  if (teams.length === 0)
    return (
      <EmptyState
        description='Um dono ou administrador pode criar o primeiro time.'
        title='Nenhum time criado'
      />
    )
  return (
    <div className='grid min-w-0 gap-5 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]'>
      <ul
        aria-label='Times'
        className='divide-y divide-border rounded-md border border-border'
      >
        {teams.map((team) => (
          <li key={team.id}>
            <button
              aria-current={selected?.id === team.id ? 'true' : undefined}
              className='w-full p-3 text-left hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'
              data-team-id={team.id}
              onClick={onSelect}
              type='button'
            >
              <span className='block font-semibold text-sm'>{team.name}</span>
              <span className='text-muted-foreground text-xs'>
                {team.memberCount} integrantes · Líder: {team.leaderName}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <TeamDetails
          busy={busy}
          error={error}
          key={selected.id}
          loading={loading}
          mayManageAll={mayManageAll}
          members={members}
          onAdd={onAdd}
          onDelete={onDelete}
          onRemove={onRemove}
          onRename={onRename}
          onRetry={onRetry}
          onTransfer={onTransfer}
          ownerId={ownerId}
          team={selected}
          teamMembers={teamMembers}
        />
      ) : null}
    </div>
  )
}
