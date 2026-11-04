import {
  ArrowLeftIcon,
  FloppyDiskIcon,
  FolderOpenIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { adminWorkspaceQueryKey, adminWorkspacesQueryKey } from '@/api/admin'
import { adminApi, workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type {
  AdminPendingInvite,
  AdminWorkspaceResponse,
  WorkspaceMemberDto,
} from '@/api/types'
import { workspaceRolesQueryKey } from '@/api/workspace-keys'
import { AdminInviteDialog } from '@/components/admin-invite-dialog'
import { AdminMemberRow } from '@/components/admin-member-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { appToast } from '@/components/ui/toast'
import { selectAdminWorkspace } from '@/hooks/use-admin-workspace-selection'

export const Route = createFileRoute('/_protected/administracao/$workspaceId')({
  component: AdminWorkspacePage,
  head: () => ({
    meta: [{ title: 'Workspace | Administração | Vaulty' }],
  }),
})

const nameSchema = z
  .string()
  .trim()
  .min(3, 'O nome deve ter pelo menos 3 caracteres.')
  .max(100, 'O nome deve ter no máximo 100 caracteres.')

function AdminWorkspacePage() {
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

  return <AdminWorkspaceDetail />
}

function AdminWorkspaceDetail() {
  const { workspaceId } = Route.useParams()
  const detail = useQuery({
    queryFn: async () => (await adminApi.getWorkspace(workspaceId)).data,
    queryKey: adminWorkspaceQueryKey(workspaceId),
  })
  const retry = useCallback(async () => {
    await detail.refetch()
  }, [detail.refetch])

  return (
    <main className='container mx-auto space-y-8 px-4 py-8 md:px-8 md:py-12'>
      <Link
        className='inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground'
        to='/'
      >
        <ArrowLeftIcon aria-hidden='true' size={12} />
        Workspaces
      </Link>
      {detail.isPending ? <LoadingState label='Carregando workspace…' /> : null}
      {detail.isError ? (
        <ErrorState
          error={detail.error}
          message='Não foi possível carregar o workspace.'
          onRetry={retry}
        />
      ) : null}
      {detail.data?.workspace ? (
        <WorkspaceSections
          members={detail.data.members ?? []}
          workspace={detail.data.workspace}
          workspaceId={workspaceId}
        />
      ) : null}
    </main>
  )
}

function WorkspaceSections({
  members,
  workspace,
  workspaceId,
}: {
  members: WorkspaceMemberDto[]
  workspace: AdminWorkspaceResponse
  workspaceId: string
}) {
  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='font-mono font-semibold text-sm uppercase tracking-wide'>
          {workspace.name}
        </h1>
        <OpenWorkspaceContentButton workspaceId={workspaceId} />
      </div>
      <WorkspaceSettingsForm
        key={workspace.name}
        workspace={workspace}
        workspaceId={workspaceId}
      />
      <MembersSection members={members} workspaceId={workspaceId} />
      <PendingInvitesSection workspace={workspace} workspaceId={workspaceId} />
    </>
  )
}

function OpenWorkspaceContentButton({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate()
  const openContent = useCallback(async () => {
    selectAdminWorkspace(workspaceId)
    await navigate({ search: {}, to: '/' })
  }, [navigate, workspaceId])

  return (
    <Button onClick={openContent} size='sm' variant='outline'>
      <FolderOpenIcon aria-hidden='true' size={16} />
      Abrir conteúdo
    </Button>
  )
}

function WorkspaceSettingsForm({
  workspace,
  workspaceId,
}: {
  workspace: AdminWorkspaceResponse
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const nameId = useId()
  const descriptionId = useId()
  const [name, setName] = useState(workspace.name ?? '')
  const [description, setDescription] = useState(workspace.description ?? '')
  const [nameError, setNameError] = useState<string>()
  const [requestError, setRequestError] = useState<string>()
  const save = useMutation({
    mutationFn: (request: { description?: string; name: string }) =>
      adminApi.updateWorkspace(workspaceId, request),
    onError: (error) => {
      setRequestError(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível salvar o workspace. Tente novamente.',
        })
      )
    },
    onSuccess: async () => {
      appToast.success('Workspace atualizado')
      await queryClient.invalidateQueries({ queryKey: adminWorkspacesQueryKey })
    },
  })
  const hasChanges =
    name.trim() !== (workspace.name ?? '').trim() ||
    description.trim() !== (workspace.description ?? '').trim()
  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = nameSchema.safeParse(name)
      if (!result.success) {
        setNameError(result.error.issues[0]?.message)
        return
      }
      setNameError(undefined)
      setRequestError(undefined)
      save.mutate({
        description: description.trim() || undefined,
        name: result.data,
      })
    },
    [description, name, save.mutate]
  )
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setNameError(undefined)
  }, [])

  return (
    <section aria-labelledby='admin-workspace-general' className='space-y-4'>
      <h2
        className='font-mono font-semibold text-xs uppercase tracking-wide'
        id='admin-workspace-general'
      >
        Configurações
      </h2>
      <form className='max-w-xl space-y-4' noValidate onSubmit={handleSubmit}>
        <Field invalid={Boolean(nameError)}>
          <FieldLabel htmlFor={nameId}>Nome do workspace</FieldLabel>
          <Input
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            aria-invalid={Boolean(nameError)}
            disabled={save.isPending}
            id={nameId}
            maxLength={100}
            onValueChange={handleNameChange}
            required
            value={name}
          />
          <FieldError id={`${nameId}-error`}>{nameError}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor={descriptionId}>Descrição</FieldLabel>
          <Textarea
            disabled={save.isPending}
            id={descriptionId}
            maxLength={2000}
            onValueChange={setDescription}
            value={description}
          />
        </Field>
        {requestError ? (
          <p className='text-destructive text-xs' role='alert'>
            {requestError}
          </p>
        ) : null}
        <Button
          disabled={!hasChanges || save.isPending}
          loading={save.isPending}
          type='submit'
        >
          <FloppyDiskIcon aria-hidden='true' size={16} />
          Salvar
        </Button>
      </form>
    </section>
  )
}

function MembersSection({
  members,
  workspaceId,
}: {
  members: WorkspaceMemberDto[]
  workspaceId: string
}) {
  const roles = useQuery({
    queryFn: async () => (await workspaceApi.listRoles(workspaceId)).data,
    queryKey: workspaceRolesQueryKey(workspaceId),
  })

  return (
    <section aria-labelledby='admin-workspace-members' className='space-y-4'>
      <h2
        className='font-mono font-semibold text-xs uppercase tracking-wide'
        id='admin-workspace-members'
      >
        Membros
      </h2>
      {members.length === 0 ? (
        <EmptyState
          description='Ninguém entrou neste workspace ainda. Convide o líder da equipe como proprietário.'
          title='Sem membros'
          variant='compact'
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>
                <span className='sr-only'>Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <AdminMemberRow
                key={member.id}
                member={member}
                roles={roles.data ?? []}
                workspaceId={workspaceId}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function PendingInvitesSection({
  workspace,
  workspaceId,
}: {
  workspace: AdminWorkspaceResponse
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const invites = workspace.pendingInvites ?? []
  const revoke = useMutation({
    mutationFn: (inviteId: string) =>
      adminApi.revokeInvite(workspaceId, inviteId),
    onError: (error) => {
      appToast.error(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível revogar o convite.',
        })
      )
    },
    onSuccess: async () => {
      appToast.success('Convite revogado')
      await queryClient.invalidateQueries({ queryKey: adminWorkspacesQueryKey })
    },
  })

  return (
    <section aria-labelledby='admin-workspace-invites' className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2
          className='font-mono font-semibold text-xs uppercase tracking-wide'
          id='admin-workspace-invites'
        >
          Convites pendentes
        </h2>
        <AdminInviteDialog
          workspaceId={workspaceId}
          workspaceName={workspace.name ?? 'workspace'}
        />
      </div>
      {invites.length === 0 ? (
        <p className='text-muted-foreground text-xs'>
          Nenhum convite pendente.
        </p>
      ) : (
        <ul className='divide-y divide-border border border-border'>
          {invites.map((invite) => (
            <PendingInviteRow
              disabled={revoke.isPending}
              invite={invite}
              key={invite.id}
              onRevoke={revoke.mutate}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function PendingInviteRow({
  disabled,
  invite,
  onRevoke,
}: {
  disabled: boolean
  invite: AdminPendingInvite
  onRevoke: (inviteId: string) => void
}) {
  const handleRevoke = useCallback(() => {
    if (invite.id) onRevoke(invite.id)
  }, [invite.id, onRevoke])

  return (
    <li className='flex items-center justify-between gap-3 px-3 py-2 text-xs'>
      <span className='flex items-center gap-2'>
        {invite.email}
        <Badge variant={invite.owner ? 'default' : 'outline'}>
          {invite.owner ? 'Proprietário' : 'Membro'}
        </Badge>
      </span>
      <Button
        aria-label={`Revogar convite de ${invite.email}`}
        disabled={disabled}
        onClick={handleRevoke}
        size='sm'
        variant='ghost'
      >
        <XIcon aria-hidden='true' size={14} />
        Revogar
      </Button>
    </li>
  )
}
