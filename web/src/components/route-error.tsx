import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { ErrorState } from './ui/error-state'

interface RouteErrorProps {
  error: unknown
  reset: () => void
}

export function RouteError({ error, reset }: RouteErrorProps) {
  const router = useRouter()

  const handleRetry = useCallback(async () => {
    reset()
    await router.invalidate()
  }, [reset, router])

  return <ErrorState error={error} onRetry={handleRetry} />
}
