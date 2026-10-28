import {
  GearIcon,
  MagnifyingGlassIcon,
  ShieldIcon,
  TrashIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import type { WorkspaceMemberResponse } from '@/api/types'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
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

export const Route = createFileRoute('/_protected/configuracoes-workspace')({
  component: WorkspaceSettingsPage,
  head: () => ({ meta: [{ title: 'Membros do workspace | Vaulty' }] }),
})

function WorkspaceSettingsPage() {
  const { session } = Route.useRouteContext()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedMember, setSelectedMember] = useState<{
    id: string
    name: string
  }>()
  const workspaces = useQuery({
    queryFn: async () => (await workspaceApi.list()).data,
    queryKey: ['workspaces'],
  })
  const workspace = workspaces.data?.[0]
  const workspaceId = workspace?.id
  const members = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceApi.listMembers(workspaceId)).data
    },
    queryKey: ['workspace-members', workspaceId],
  })
  const retryWorkspaces = useCallback(async () => {
    await workspaces.refetch()
  }, [workspaces.refetch])
  const retryMembers = useCallback(async () => {
    if (!workspaceId) return
    await members.refetch()
  }, [members.refetch, workspaceId])
  const clearSelectedMember = useCallback(
    () => setSelectedMember(undefined),
    []
  )
  const handleDialogChange = useCallback(
    (open: boolean) => {
      if (!open) clearSelectedMember()
    },
    [clearSelectedMember]
  )
  const isOwner = Boolean(
    session.user?.id && workspace?.ownerId === session.user.id
  )
  const roles = useMemo(
    () =>
      [
        ...new Set(
          (members.data ?? [])
            .map((member) => member.roleName)
            .filter((role): role is string => Boolean(role))
        ),
      ].sort(),
    [members.data]
  )
  const filteredMembers = (members.data ?? []).filter((member) => {
    const matchesName = (member.name ?? '')
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
    return (
      matchesName && (roleFilter === 'all' || member.roleName === roleFilter)
    )
  })
  const ownerCount = (members.data ?? []).filter(
    (member) => member.roleName?.toLocaleLowerCase() === 'owner'
  ).length
  const removesLastOwner = isLastWorkspaceOwner(
    selectedMember?.id,
    workspace?.ownerId,
    ownerCount
  )
  const memberAccessError = members.isError
    ? toApiError(members.error)
    : undefined
  const memberAccessDenied = isWorkspaceAccessDenied(memberAccessError)

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
  if (!workspace?.id) {
    return (
      <main className='container mx-auto px-8 py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar os membros. Peça a um dono para verificar seu acesso.'
          title='Nenhum workspace disponível'
        />
      </main>
    )
  }

  return (
    <main className='container mx-auto space-y-6 px-8 py-12'>
      <header className='flex flex-col gap-6'>
        <AppBreadcrumb
          items={[{ label: 'Início', to: '/' }, { label: 'Configurações' }]}
        />
        <div className='flex items-center gap-4'>
          <GearIcon
            aria-hidden='true'
            className='size-6 shrink-0 text-primary'
          />
          <h1 className='font-bold font-mono text-3xl'>CONFIGURAÇÕES</h1>
        </div>
      </header>
      <div className='flex min-w-0 flex-col gap-8 sm:flex-row'>
        <nav
          aria-label='Configurações do workspace'
          className='flex w-full shrink-0 flex-col gap-1 sm:w-52'
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
        <Separator className='hidden h-auto sm:block' orientation='vertical' />
        <Separator className='sm:hidden' />
        <section
          aria-labelledby='members-title'
          className='min-w-0 flex-1 space-y-4'
        >
          <div>
            <h2
              className='font-bold font-mono text-sm uppercase tracking-wide'
              id='members-title'
            >
              Membros do workspace
            </h2>
            <p className='mt-1 text-muted-foreground text-xs'>
              Consulte quem tem acesso ao workspace e seu papel.
            </p>
          </div>
          <div className='flex flex-col gap-2 sm:flex-row'>
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
              <SelectTrigger aria-label='Filtrar por cargo' className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos os cargos</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tabs defaultValue='members'>
            <TabsList>
              <TabsTrigger value='members'>
                Membros ({members.isError ? 0 : (members.data?.length ?? 0)})
              </TabsTrigger>
            </TabsList>
            <TabsContent value='members'>
              {members.isPending ? (
                <LoadingState label='Carregando membros…' />
              ) : null}
              {members.isError ? (
                <ErrorState
                  error={members.error}
                  message={
                    memberAccessDenied
                      ? 'Acesso ao workspace negado. Se você perdeu o vínculo, procure um dono.'
                      : 'Não foi possível carregar os membros.'
                  }
                  onRetry={retryMembers}
                />
              ) : null}
              {!members.isError && members.data?.length === 0 ? (
                <EmptyState
                  description='Este workspace ainda não tem membros.'
                  title='Nenhum membro encontrado'
                />
              ) : null}
              {!members.isError &&
              members.data &&
              members.data.length > 0 &&
              filteredMembers.length === 0 ? (
                <EmptyState
                  description='Ajuste a busca ou o filtro de cargo.'
                  title='Nenhum resultado'
                  variant='compact'
                />
              ) : null}
              {!members.isError && filteredMembers.length > 0 ? (
                <div className='max-h-120 overflow-auto border border-border'>
                  <table
                    aria-label='Membros, cargo, estado e data de entrada'
                    className='w-full border-collapse text-left'
                  >
                    <tbody className='divide-y divide-border'>
                      {filteredMembers.map((member, index) => (
                        <MemberRow
                          index={index}
                          isLastOwner={isLastWorkspaceOwner(
                            member.userId,
                            workspace.ownerId,
                            ownerCount
                          )}
                          isOwner={isOwner}
                          key={member.id}
                          member={member}
                          onSelect={setSelectedMember}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <p className='text-muted-foreground text-xs'>
            Estado de acesso e data de entrada ainda não são fornecidos pela
            API.
          </p>
          <p className='text-muted-foreground text-xs'>
            A API ainda não oferece a remoção de membros; essa ação ficará
            disponível quando o servidor implementar as regras de acesso e
            proteção do último dono.
          </p>
        </section>
      </div>
      <Dialog onOpenChange={handleDialogChange} open={Boolean(selectedMember)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover membro</DialogTitle>
            <DialogDescription>
              Confirme a remoção de {selectedMember?.name} do workspace.
            </DialogDescription>
          </DialogHeader>
          <p className='text-muted-foreground text-sm' role='status'>
            {removesLastOwner
              ? 'Este membro é o último dono do workspace e não pode ser removido.'
              : 'A remoção não está disponível porque a API do servidor ainda não implementa essa operação.'}
          </p>
          <DialogFooter>
            <Button onClick={clearSelectedMember} variant='outline'>
              Fechar
            </Button>
            <Button disabled variant='destructive'>
              Remoção indisponível
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function MemberRow({
  index,
  isLastOwner,
  isOwner,
  member,
  onSelect,
}: {
  index: number
  isLastOwner: boolean
  isOwner: boolean
  member: WorkspaceMemberResponse
  onSelect: (member: { id: string; name: string }) => void
}) {
  const name = member.name || 'Usuário sem nome'
  const selectMember = useCallback(
    () => onSelect({ id: member.userId ?? member.id ?? '', name }),
    [member.id, member.userId, name, onSelect]
  )

  return (
    <tr className={index % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
      <td className='px-4 py-3'>
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
      <td className='px-2 py-3'>
        <span className='flex w-fit shrink-0 items-center gap-1.5 border border-primary/50 bg-primary/5 px-2 py-1 font-mono text-primary text-xs uppercase'>
          <ShieldIcon aria-hidden='true' className='size-3' />
          {member.roleName ?? '—'}
        </span>
      </td>
      <td className='hidden px-2 py-3 font-mono text-muted-foreground text-xs md:table-cell'>
        Estado: —
      </td>
      <td className='hidden px-2 py-3 font-mono text-muted-foreground text-xs lg:table-cell'>
        Entrada: —
      </td>
      <td className='px-3 py-3 text-right'>
        <Button
          aria-label={`Remover ${name}`}
          className='size-7 shrink-0 border border-destructive/40 text-destructive hover:bg-destructive/10'
          disabled={!isOwner || isLastOwner}
          onClick={selectMember}
          size='icon'
          title={
            isOwner
              ? isLastOwner
                ? 'O último dono não pode ser removido.'
                : 'Remoção indisponível até a API oferecer essa operação.'
              : 'Somente um dono pode remover membros.'
          }
          variant='ghost'
        >
          <TrashIcon aria-hidden='true' className='size-3.5' />
        </Button>
      </td>
    </tr>
  )
}

function isLastWorkspaceOwner(
  memberId: string | undefined,
  ownerId: string | undefined,
  ownerCount: number
) {
  return memberId === ownerId && ownerCount <= 1
}

function isWorkspaceAccessDenied(
  error: ReturnType<typeof toApiError> | undefined
) {
  return error?.status === 403 || error?.status === 404
}
