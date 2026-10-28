export const MEMBER_MANAGEMENT_AVAILABLE: boolean = false

export function getMemberPermissions({
  currentUserId,
  workspaceOwnerId,
  memberUserId,
  managementAvailable = MEMBER_MANAGEMENT_AVAILABLE,
}: {
  currentUserId: string | undefined
  workspaceOwnerId: string | undefined
  memberUserId: string
  managementAvailable?: boolean
}) {
  const isOwner = Boolean(currentUserId && currentUserId === workspaceOwnerId)
  const isSelf = currentUserId === memberUserId
  const isLastOwner = Boolean(
    workspaceOwnerId && memberUserId === workspaceOwnerId
  )
  const canRequestRemoval = isOwner && !isLastOwner

  return {
    canChangeRole: managementAvailable && isOwner && !isSelf,
    canRemove: managementAvailable && canRequestRemoval,
    canRequestRemoval,
    changeRoleReason: isOwner
      ? isSelf
        ? 'Você não pode alterar o próprio cargo.'
        : managementAvailable
          ? undefined
          : 'A alteração de cargo ainda não está disponível na API.'
      : 'Somente um dono pode alterar cargos.',
    isLastOwner,
    isOwner,
    isSelf,
    removeReason: isOwner
      ? isLastOwner
        ? 'O último dono do workspace não pode ser removido.'
        : managementAvailable
          ? undefined
          : 'A remoção ainda não está disponível na API do servidor.'
      : 'Somente um dono pode remover membros.',
  }
}
