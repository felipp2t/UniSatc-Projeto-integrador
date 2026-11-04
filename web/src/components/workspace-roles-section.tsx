import {
  DotsThreeVerticalIcon,
  EyeIcon,
  PencilSimpleIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { workspaceApi } from '@/api/endpoints'
import type {
  WorkspaceRolePermission,
  WorkspaceRoleResponse,
} from '@/api/types'
import { CreateRoleDialog } from '@/components/create-role-dialog'
import { DeleteRoleDialog } from '@/components/delete-role-dialog'
import { RenameRoleDialog } from '@/components/rename-role-dialog'
import { RolePermissionsEditor } from '@/components/role-permissions-editor'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface WorkspaceRolesSectionProps {
  onDeleteRole?: (role: WorkspaceRoleResponse) => void
  onEditPermissions?: (role: WorkspaceRoleResponse) => void
  onRetry: () => Promise<void>
  roles: WorkspaceRoleResponse[]
  rolesError: unknown
  rolesPending: boolean
  workspaceId: string
}

export function WorkspaceRolesSection({
  onDeleteRole,
  onEditPermissions,
  onRetry,
  roles,
  rolesError,
  rolesPending,
  workspaceId,
}: WorkspaceRolesSectionProps) {
  const [editingRole, setEditingRole] = useState<WorkspaceRoleResponse | null>(
    null
  )
  const [renamingRole, setRenamingRole] =
    useState<WorkspaceRoleResponse | null>(null)
  const [permissionsReadOnly, setPermissionsReadOnly] = useState(false)
  const roleIds = roles.map((role) => role.id).join(',')
  const permissions = useQuery({
    enabled: roles.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        roles.map(
          async (role) =>
            [
              role.id,
              (await workspaceApi.listRolePermissions(workspaceId, role.id))
                .data,
            ] as const
        )
      )
      const result: Record<string, WorkspaceRolePermission[]> = {}
      for (const [roleId, rolePermissions] of entries) {
        result[roleId] = rolePermissions
      }
      return result
    },
    queryKey: ['workspace-role-permission-counts', workspaceId, roleIds],
  })
  const retryPermissions = useCallback(async () => {
    await permissions.refetch()
  }, [permissions.refetch])
  const openPermissions = useCallback(
    (role: WorkspaceRoleResponse) => {
      setPermissionsReadOnly(false)
      if (onEditPermissions) onEditPermissions(role)
      else setEditingRole(role)
    },
    [onEditPermissions]
  )
  const viewPermissions = useCallback((role: WorkspaceRoleResponse) => {
    setPermissionsReadOnly(true)
    setEditingRole(role)
  }, [])
  const handleEditorOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingRole(null)
  }, [])
  const handleRenameOpenChange = useCallback((open: boolean) => {
    if (!open) setRenamingRole(null)
  }, [])

  if (rolesPending) return <LoadingState label='Carregando cargos…' />
  if (rolesError) {
    return (
      <ErrorState
        error={rolesError}
        message='Não foi possível carregar os cargos.'
        onRetry={onRetry}
      />
    )
  }
  if (roles.length === 0) {
    return (
      <EmptyState
        action={
          <CreateRoleDialog workspaceId={workspaceId}>
            <Button>Criar primeiro cargo</Button>
          </CreateRoleDialog>
        }
        description='Crie o primeiro cargo para definir as permissões dos membros.'
        title='Nenhum cargo personalizado'
      />
    )
  }
  if (permissions.isError) {
    return (
      <ErrorState
        error={permissions.error}
        message='Não foi possível carregar as permissões dos cargos.'
        onRetry={retryPermissions}
      />
    )
  }

  return (
    <section aria-label='Cargos do workspace' className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground text-xs'>
          {roles.length} {roles.length === 1 ? 'cargo' : 'cargos'} no workspace
        </p>
        <CreateRoleDialog workspaceId={workspaceId}>
          <Button size='sm'>Criar cargo</Button>
        </CreateRoleDialog>
      </div>
      <Table
        aria-label='Cargos do workspace'
        className='w-fit min-w-[32rem] max-w-full table-fixed'
      >
        <TableHeader>
          <TableRow>
            <TableHead className='w-56'>Nome</TableHead>
            <TableHead className='w-24'>Membros</TableHead>
            <TableHead className='w-28'>Permissões</TableHead>
            <TableHead className='w-12'>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <WorkspaceRoleRow
              key={role.id}
              onDeleteRole={onDeleteRole}
              onEditPermissions={openPermissions}
              onRenameRole={setRenamingRole}
              onViewPermissions={viewPermissions}
              permissionsCount={permissions.data?.[role.id]?.length ?? 0}
              permissionsPending={permissions.isPending}
              role={role}
              workspaceId={workspaceId}
            />
          ))}
        </TableBody>
      </Table>
      {editingRole ? (
        <RolePermissionsEditor
          builtIn={editingRole.builtIn}
          canManage
          onOpenChange={handleEditorOpenChange}
          open
          readOnly={permissionsReadOnly}
          roleId={editingRole.id}
          roleName={editingRole.name}
          workspaceId={workspaceId}
        />
      ) : null}
      {renamingRole ? (
        <RenameRoleDialog
          key={renamingRole.id}
          onOpenChange={handleRenameOpenChange}
          open
          role={renamingRole}
          workspaceId={workspaceId}
        />
      ) : null}
    </section>
  )
}

function WorkspaceRoleRow({
  onDeleteRole,
  onEditPermissions,
  onRenameRole,
  onViewPermissions,
  permissionsCount,
  permissionsPending,
  role,
  workspaceId,
}: {
  onDeleteRole?: (role: WorkspaceRoleResponse) => void
  onEditPermissions?: (role: WorkspaceRoleResponse) => void
  onRenameRole: (role: WorkspaceRoleResponse) => void
  onViewPermissions: (role: WorkspaceRoleResponse) => void
  permissionsCount: number
  permissionsPending: boolean
  role: WorkspaceRoleResponse
  workspaceId: string
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const handleRename = useCallback(
    () => onRenameRole(role),
    [onRenameRole, role]
  )
  const handleEditPermissions = useCallback(
    () => onEditPermissions?.(role),
    [onEditPermissions, role]
  )
  const handleViewPermissions = useCallback(
    () => onViewPermissions(role),
    [onViewPermissions, role]
  )
  const handleDelete = useCallback(() => {
    if (onDeleteRole) onDeleteRole(role)
    else setDeleteDialogOpen(true)
  }, [onDeleteRole, role])

  return (
    <TableRow>
      <TableCell className='font-semibold'>
        <div className='flex items-center gap-1'>
          <span>{role.name}</span>
          {role.builtIn ? (
            <span className='sr-only' id={`rename-disabled-${role.id}`}>
              Cargos iniciais não podem ser renomeados.
            </span>
          ) : null}
          <Button
            aria-describedby={
              role.builtIn ? `rename-disabled-${role.id}` : undefined
            }
            aria-label={`Renomear cargo ${role.name}`}
            className='size-6 p-0'
            disabled={role.builtIn}
            onClick={handleRename}
            size='icon'
            title={
              role.builtIn
                ? 'Cargos iniciais não podem ser renomeados.'
                : `Renomear ${role.name}`
            }
            variant='ghost'
          >
            <PencilSimpleIcon aria-hidden='true' size={14} />
          </Button>
        </div>
      </TableCell>
      <TableCell>{role.memberCount}</TableCell>
      <TableCell>
        {permissionsPending ? <span>…</span> : <span>{permissionsCount}</span>}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Ações do cargo ${role.name}`}
              className='size-7'
              size='icon'
              variant='ghost'
            >
              <DotsThreeVerticalIcon aria-hidden='true' size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              disabled={permissionsPending}
              onSelect={handleViewPermissions}
            >
              <EyeIcon aria-hidden='true' />
              Visualizar permissões
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!onEditPermissions}
              onSelect={handleEditPermissions}
            >
              <SlidersHorizontalIcon aria-hidden='true' />
              Ajustar permissões
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleDelete} variant='destructive'>
              <TrashIcon aria-hidden='true' />
              Excluir cargo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onDeleteRole ? null : (
          <DeleteRoleDialog
            onOpenChange={setDeleteDialogOpen}
            open={deleteDialogOpen}
            role={role}
            workspaceId={workspaceId}
          />
        )}
      </TableCell>
    </TableRow>
  )
}
