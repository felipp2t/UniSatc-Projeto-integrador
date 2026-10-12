import { RouteError } from './components/route-error'
import { LoadingState } from './components/ui/loading-state'

export const routerDefaults = {
  defaultErrorComponent: RouteError,
  defaultPendingComponent: LoadingState,
  defaultPendingMinMs: 500,
  defaultPendingMs: 1000,
} as const
