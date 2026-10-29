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
}: {
  currentUserId: string | undefined
  workspaceOwnerId: string | undefined
  memberUserId: string
}) {
  const isOwner = isWorkspaceOwner(currentUserId, workspaceOwnerId)
  const isSelf = currentUserId === memberUserId
  const isLastOwner = Boolean(
    workspaceOwnerId && memberUserId === workspaceOwnerId
  )
  return {
    changeRoleReason: isOwner
      ? isSelf
        ? 'Você não pode alterar o próprio cargo.'
        : 'A alteração de cargo ainda não está disponível na API.'
      : 'Somente um dono pode alterar cargos.',
    isLastOwner,
    isOwner,
    isSelf,
    removeReason: isOwner
      ? isLastOwner
        ? 'O último dono do workspace não pode ser removido.'
        : 'A remoção ainda não está disponível na API do servidor.'
      : 'Somente um dono pode remover membros.',
  }
}
