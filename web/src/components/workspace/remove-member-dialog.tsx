import type { WorkspaceMemberResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MemberRemoval } from '@/hooks/use-remove-member'

function describeRemoval(member: WorkspaceMemberResponse) {
  return `Confirme a remoção de ${member.name} (${member.email ?? member.userId}). A conta e o conteúdo criado por essa pessoa permanecem preservados.`
}

export function RemoveMemberDialog({ removal }: { removal: MemberRemoval }) {
  const { error, isPending, memberToRemove } = removal

  return (
    <Dialog onOpenChange={removal.onOpenChange} open={memberToRemove !== null}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Remover membro</DialogTitle>
          <DialogDescription>
            {memberToRemove ? describeRemoval(memberToRemove) : null}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className='text-destructive text-xs' role='alert'>
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={removal.cancel}
            variant='outline'
          >
            Cancelar
          </Button>
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={removal.confirm}
            variant='destructive'
          >
            {isPending ? 'Removendo…' : 'Remover membro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
