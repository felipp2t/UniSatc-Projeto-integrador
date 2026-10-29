export const MEMBER_MANAGEMENT_AVAILABLE: boolean = false

export type MemberPermissions = ReturnType<typeof getMemberPermissions>

export function isWorkspaceOwner(
  currentUserId: string | undefined,
  workspaceOwnerId: string | undefined
) {
  return Boolean(currentUserId && currentUserId === workspaceOwnerId)
}

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
  const isOwner = isWorkspaceOwner(currentUserId, workspaceOwnerId)
  const isSelf = currentUserId === memberUserId
  const isLastOwner = Boolean(
    workspaceOwnerId && memberUserId === workspaceOwnerId
  )
  return {
    canChangeRole: managementAvailable && isOwner && !isSelf,
    canRemove: managementAvailable && isOwner && !isLastOwner,
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
