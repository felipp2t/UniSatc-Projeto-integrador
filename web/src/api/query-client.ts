import { QueryClient } from '@tanstack/react-query'
import { toApiError } from './errors'

export function retryQuery(failureCount: number, error: unknown) {
  const apiError = toApiError(error)

  if (
    !apiError.isCanceled &&
    (apiError.isNetworkError || apiError.isServerError)
  ) {
    return failureCount < 2
  }

  return false
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        networkMode: 'always',
        retry: false,
      },
      queries: {
        networkMode: 'online',
        refetchOnWindowFocus: false,
        retry: retryQuery,
        staleTime: 30_000,
      },
    },
  })
}
