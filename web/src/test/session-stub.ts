import { vi } from 'vitest'
import type { SessionService } from '@/auth/session'

export function createSessionStub(
  overrides: Partial<SessionService> = {}
): SessionService {
  return {
    clearLocalSession: vi.fn(),
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    setNavigateToLogin: vi.fn(),
    status: 'unauthenticated',
    updateUser: vi.fn(),
    user: undefined,
    ...overrides,
  }
}
