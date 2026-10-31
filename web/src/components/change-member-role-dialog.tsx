import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MemberRoleChange } from '@/hooks/use-change-member-role'

export function getRoleChangeDescription({
  losesOwnManagement,
  memberName,
  roleName,
}: {
  losesOwnManagement: boolean
  memberName: string
  roleName: string
}) {
  const description = `Alterar o cargo de ${memberName} para ${roleName}?`
  return losesOwnManagement
    ? `${description} Você perderá o acesso de gestão de membros deste workspace.`
    : description
}

export function ChangeMemberRoleDialog({
  roleChange,
}: {
  roleChange: MemberRoleChange
}) {
  const { pendingRoleChange } = roleChange

  return (
    <Dialog
      onOpenChange={roleChange.onOpenChange}
      open={pendingRoleChange !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar alteração de cargo</DialogTitle>
          <DialogDescription>
            {pendingRoleChange
              ? getRoleChangeDescription({
                  losesOwnManagement: roleChange.losesOwnManagement,
                  memberName: pendingRoleChange.member.name,
                  roleName: pendingRoleChange.roleName,
                })
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={roleChange.cancel} variant='outline'>
            Cancelar
          </Button>
          <Button onClick={roleChange.confirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
