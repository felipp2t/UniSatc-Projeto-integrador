import { vi } from 'vitest'

export const workspaceApiMocks = {
  backup: vi.fn(),
  changeMemberRole: vi.fn(),
  list: vi.fn(),
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  removeMember: vi.fn(),
  update: vi.fn(),
}
export const inviteApiMocks = {
  create: vi.fn(),
  list: vi.fn(),
}
export const toastError = vi.fn()
export const toastSuccess = vi.fn()
