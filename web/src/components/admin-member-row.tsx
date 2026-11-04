import { UserMinusIcon } from '@phosphor-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { adminWorkspacesQueryKey } from '@/api/admin'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { WorkspaceMemberDto, WorkspaceRoleResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { appToast } from '@/components/ui/toast'

const roleLabels: Record<string, string> = {
  Member: 'Membro',
  Owner: 'Proprietário',
}

const lastOwnerMessage = 'O workspace precisa manter ao menos um proprietário.'

export function roleLabel(roleName: string | undefined) {
  return roleLabels[roleName ?? ''] ?? roleName ?? ''
}

interface AdminMemberRowProps {
  member: WorkspaceMemberDto
  roles: WorkspaceRoleResponse[]
  workspaceId: string
}

export function AdminMemberRow({
  member,
  roles,
  workspaceId,
}: AdminMemberRowProps) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: adminWorkspacesQueryKey }),
    [queryClient]
  )
  const changeRole = useMutation({
    mutationFn: (roleId: string) =>
      workspaceApi.changeMemberRole(workspaceId, member.id ?? '', roleId),
    onError: (error) => {
      appToast.error(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível alterar o papel.',
          statusMessages: { 409: lastOwnerMessage },
        })
      )
    },
    onSuccess: async () => {
      appToast.success(`Papel de ${member.name} atualizado`)
      await refresh()
    },
  })
  const removeMember = useMutation({
    mutationFn: () => workspaceApi.removeMember(workspaceId, member.id ?? ''),
    onError: (error) => {
      appToast.error(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível remover o membro.',
          statusMessages: { 409: lastOwnerMessage },
        })
      )
    },
    onSuccess: async () => {
      appToast.success(`${member.name} foi removido do workspace`)
      setConfirmOpen(false)
      await refresh()
    },
  })
  const busy = changeRole.isPending || removeMember.isPending
  const handleRoleChange = useCallback(
    (roleId: string) => {
      if (roleId !== member.roleId) changeRole.mutate(roleId)
    },
    [changeRole.mutate, member.roleId]
  )
  const openConfirm = useCallback(() => setConfirmOpen(true), [])
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const confirmRemoval = useCallback(
    () => removeMember.mutate(),
    [removeMember.mutate]
  )

  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>
        <Select
          disabled={busy || roles.length === 0}
          onValueChange={handleRoleChange}
          value={member.roleId}
        >
          <SelectTrigger
            aria-label={`Papel de ${member.name}`}
            className='w-40'
          >
            <SelectValue>{roleLabel(member.roleName)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {roleLabel(role.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className='text-right'>
        <Button
          aria-label={`Remover ${member.name} do workspace`}
          disabled={busy}
          onClick={openConfirm}
          size='sm'
          variant='ghost'
        >
          <UserMinusIcon aria-hidden='true' size={14} />
          Remover
        </Button>
        <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remover {member.name}?</DialogTitle>
              <DialogDescription>
                A pessoa perde o acesso a este workspace na próxima requisição.
                A conta, o conteúdo que ela criou e a autoria no histórico
                continuam. Depois, você pode adicioná-la a outro workspace.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                disabled={removeMember.isPending}
                onClick={closeConfirm}
                variant='outline'
              >
                Cancelar
              </Button>
              <Button
                disabled={removeMember.isPending}
                loading={removeMember.isPending}
                onClick={confirmRemoval}
                variant='destructive'
              >
                Remover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  )
}
