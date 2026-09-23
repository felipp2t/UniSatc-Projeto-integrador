import type { PermissionChecker } from './auth/permissions'
import type { SessionService } from './auth/session'

export interface RouterContext {
  permissionChecker: PermissionChecker
  session: SessionService
}
