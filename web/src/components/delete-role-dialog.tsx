import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { workspaceRolesQueryKey } from '@/api/workspace-keys'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { appToast } from '@/components/ui/toast'

export interface DeletableWorkspaceRole {
  builtIn: boolean
  id: string
  memberCount: number
  name: string
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
  workspaceId,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: DeletableWorkspaceRole
  workspaceId: string
  onDeleted?: (roleId: string) => void
}) {
  const queryClient = useQueryClient()
  const deleteRole = useMutation({
    mutationFn: () => workspaceApi.deleteRole(workspaceId, role.id),
    onSuccess: async () => {
      onOpenChange(false)
      appToast.success(`Cargo “${role.name}” excluído.`)
      onDeleted?.(role.id)
      await queryClient.invalidateQueries({
        queryKey: workspaceRolesQueryKey(workspaceId),
      })
    },
  })

  const blockedReason = role.builtIn
    ? 'Os cargos iniciais não podem ser excluídos.'
    : role.memberCount > 0
      ? `Reatribua os ${role.memberCount} membros antes de excluir este cargo.`
      : undefined
  const error = deleteRole.error
    ? getApiErrorMessage(deleteRole.error, {
        fallback: 'Não foi possível excluir o cargo. Tente novamente.',
        statusMessages: {
          403: 'Você não tem permissão para excluir cargos.',
          404: 'Este cargo não está mais no workspace. Atualize a lista.',
          409: 'Este cargo ainda está atribuído a membros. Reatribua-os e tente novamente.',
        },
      })
    : undefined

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (deleteRole.isPending) return
      if (!nextOpen) deleteRole.reset()
      onOpenChange(nextOpen)
    },
    [deleteRole.isPending, deleteRole.reset, onOpenChange]
  )
  const cancel = useCallback(() => handleOpenChange(false), [handleOpenChange])
  const confirm = useCallback(() => deleteRole.mutate(), [deleteRole.mutate])

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Excluir cargo</DialogTitle>
          <DialogDescription>
            {blockedReason ?? <>Confirme a exclusão do cargo “{role.name}”.</>}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className='text-destructive text-xs' role='alert'>
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={deleteRole.isPending}
            onClick={cancel}
            variant='outline'
          >
            Cancelar
          </Button>
          <Button
            disabled={Boolean(blockedReason) || deleteRole.isPending}
            loading={deleteRole.isPending}
            onClick={confirm}
            variant='destructive'
          >
            {deleteRole.isPending ? 'Excluindo…' : 'Excluir cargo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
