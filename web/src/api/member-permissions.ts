export type MemberPermissions = ReturnType<typeof getMemberPermissions>

export const OWNER_ROLE = 'Owner'

export function isOwnerRole(roleName: string | undefined) {
  return roleName === OWNER_ROLE
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
  const isLastOwner = isOwnerRole(memberRoleName) && ownerCount === 1
  return {
    isLastOwner,
    removeReason: isOwnerRole(currentUserRole)
      ? isLastOwner
        ? 'O último dono do workspace não pode ser removido.'
        : 'A remoção ainda não está disponível na API do servidor.'
      : 'Somente um dono pode remover membros.',
  }
}
