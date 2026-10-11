import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toApiError } from '@/api/errors'
import { ErrorState } from './ui/error-state'
import { LoadingState } from './ui/loading-state'

interface RouteErrorProps {
  error: unknown
  reset: () => void
}

export function RouteError({ error, reset }: RouteErrorProps) {
  const router = useRouter()
  const apiError = toApiError(error)

  const handleRetry = useCallback(async () => {
    reset()
    await router.invalidate()
  }, [reset, router])

  return <ErrorState error={apiError} onRetry={handleRetry} />
}

export function RoutePending() {
  return <LoadingState />
}
