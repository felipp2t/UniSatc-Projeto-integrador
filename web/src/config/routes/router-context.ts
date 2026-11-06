import type { QueryClient } from '@tanstack/react-query'
import type { SessionService } from '../../auth/session'

export interface RouterContext {
  queryClient: QueryClient
  session: SessionService
}
