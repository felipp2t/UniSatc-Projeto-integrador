import type { UseQueryResult } from '@tanstack/react-query'
import { useCallback } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { OfflineState } from '@/components/ui/offline-state'

interface AsyncBoundaryProps<TData, TError = Error> {
  children: (data: TData) => React.ReactNode
  empty?: React.ReactNode
  isEmpty?: (data: TData) => boolean
  loading?: React.ReactNode
  query: UseQueryResult<TData, TError>
}

const defaultIsEmpty = (data: unknown) =>
  Array.isArray(data) && data.length === 0

export function AsyncBoundary<TData, TError = Error>({
  children,
  empty,
  isEmpty = defaultIsEmpty,
  loading,
  query,
}: AsyncBoundaryProps<TData, TError>) {
  const { data, refetch } = query
  const handleRetry = useCallback(async () => {
    await refetch()
  }, [refetch])

  if (data !== undefined) {
    const content = isEmpty(data)
      ? (empty ?? <EmptyState title='Nenhum resultado encontrado.' />)
      : children(data)

    return (
      <>
        {content}
        {query.isRefetchError ? (
          <ErrorState
            error={query.error}
            onRetry={handleRetry}
            variant='compact'
          />
        ) : null}
      </>
    )
  }

  if (query.fetchStatus === 'paused') return <OfflineState />
  if (query.isError)
    return <ErrorState error={query.error} onRetry={handleRetry} />
  return loading ?? <LoadingState />
}
