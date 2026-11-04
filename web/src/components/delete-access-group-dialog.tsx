import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { accessGroupApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { AccessGroupResponse } from '@/api/types'
import { accessGroupsQueryKey } from '@/api/workspace-keys'
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

export function DeleteAccessGroupDialog({
  group,
  onOpenChange,
  open,
  onDeleted,
  workspaceId,
}: {
  group?: AccessGroupResponse
  onDeleted: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const pending = useRef({ active: false })
  const opener = useRef<HTMLElement | null>(null)
  const [deleted, setDeleted] = useState(false)
  const handleCloseAutoFocus = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault()
      const target = deleted
        ? document.getElementById('access-groups-title')
        : opener.current
      if (target?.isConnected) target.focus()
      setDeleted(false)
    },
    [deleted]
  )
  const handleOpenAutoFocus = useCallback(() => {
    const { activeElement } = document
    opener.current = activeElement instanceof HTMLElement ? activeElement : null
  }, [])
  const mutation = useMutation({
    mutationFn: () => {
      if (!group) throw new Error('Grupo indisponível.')
      return accessGroupApi.delete(workspaceId, group.id)
    },
    onError: (cause: unknown) => {
      appToast.error(
        getApiErrorMessage(cause, {
          fallback: 'Não foi possível excluir o grupo.',
          statusMessages: {
            403: 'Você não tem permissão para gerenciar grupos.',
            404: 'O workspace ou grupo não foi encontrado.',
            409: 'Remova os integrantes e vínculos do grupo antes de excluí-lo.',
          },
        })
      )
    },
    onSettled: () => {
      pending.current.active = false
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accessGroupsQueryKey(workspaceId),
      })
      appToast.success('Grupo excluído.')
      setDeleted(true)
      onOpenChange(false)
      onDeleted()
    },
  })
  const cancel = useCallback(() => onOpenChange(false), [onOpenChange])
  const confirm = useCallback(() => {
    if (!group || pending.current.active) return
    pending.current.active = true
    mutation.mutate()
  }, [group, mutation.mutate])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        onCloseAutoFocus={handleCloseAutoFocus}
        onOpenAutoFocus={handleOpenAutoFocus}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Excluir grupo?</DialogTitle>
          <DialogDescription>
            O grupo “{group?.name}” só pode ser excluído quando não tiver
            integrantes nem recursos vinculados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={cancel}
            variant='outline'
          >
            Cancelar
          </Button>
          <Button
            disabled={!group || mutation.isPending}
            loading={mutation.isPending}
            onClick={confirm}
            variant='destructive'
          >
            Excluir grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
