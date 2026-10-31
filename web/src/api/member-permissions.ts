export type MemberPermissions = ReturnType<typeof getMemberPermissions>

export function isWorkspaceOwner(roleName: string | undefined) {
  return roleName === 'Owner'
}

export function getMemberPermissions({
  currentUserRole,
  memberRoleName,
  ownerCount,
}: {
  currentUserRole: string | undefined
  memberRoleName: string
  ownerCount: number
}) {
  const isLastOwner = isWorkspaceOwner(memberRoleName) && ownerCount === 1
  return {
    removeReason: isWorkspaceOwner(currentUserRole)
      ? isLastOwner
        ? 'O último dono do workspace não pode ser removido.'
        : 'A remoção ainda não está disponível na API do servidor.'
      : 'Somente um dono pode remover membros.',
  }
}
