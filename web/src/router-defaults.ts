import { RouteError, RoutePending } from './components/route-error'

export const routerDefaults = {
  defaultErrorComponent: RouteError,
  defaultPendingComponent: RoutePending,
  defaultPendingMinMs: 500,
  defaultPendingMs: 1000,
} as const
