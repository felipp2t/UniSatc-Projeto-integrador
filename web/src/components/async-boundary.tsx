import type { UseQueryResult } from '@tanstack/react-query'
import { useCallback } from 'react'
import { EmptyState } from './ui/empty-state'
import { ErrorState } from './ui/error-state'
import { LoadingState } from './ui/loading-state'
import { OfflineState } from './ui/offline-state'

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
  isEmpty = defaultIsEmpty as (data: TData) => boolean,
  loading,
  query,
}: AsyncBoundaryProps<TData, TError>) {
  const hasData = query.data !== undefined
  const handleRetry = useCallback(async () => {
    await query.refetch()
  }, [query])

  if (hasData) {
    const data = query.data as TData
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
