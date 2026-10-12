import type { QueryClient } from '@tanstack/react-query'
import type { PermissionChecker } from './auth/permissions'
import type { SessionService } from './auth/session'

export interface RouterContext {
  permissionChecker: PermissionChecker
  queryClient: QueryClient
  session: SessionService
}
