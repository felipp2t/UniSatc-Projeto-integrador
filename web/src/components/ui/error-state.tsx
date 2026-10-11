import { useCallback } from 'react'
import { toApiError } from '@/api/errors'
import { Button } from './button'

export interface ErrorStateProps {
  error?: unknown
  message?: string
  onRetry?: () => void | Promise<void>
  variant?: 'page' | 'compact'
}

function getErrorMessage(error: unknown) {
  const apiError = toApiError(error)
  if (apiError.isNetworkError) return 'Não foi possível conectar ao servidor.'
  if (apiError.isNotFound) return 'O conteúdo solicitado não foi encontrado.'
  if (apiError.isServerError) return 'O servidor está indisponível no momento.'
  if (apiError.isUnauthorized) return 'Sua sessão não está autorizada.'
  return apiError.message || 'Não foi possível concluir a operação.'
}

export function ErrorState({
  error,
  message,
  onRetry,
  variant = 'page',
}: ErrorStateProps) {
  const handleRetry = useCallback(() => {
    if (onRetry) {
      Promise.resolve(onRetry()).catch(() => undefined)
    }
  }, [onRetry])

  return (
    <div
      aria-live='assertive'
      className={
        variant === 'compact'
          ? 'flex items-center gap-3 p-2'
          : 'flex flex-col items-center gap-3 p-8 text-center'
      }
      role='alert'
    >
      <p className='text-destructive text-sm'>
        {message ?? getErrorMessage(error)}
      </p>
      {onRetry ? (
        <Button onClick={handleRetry} size='sm' variant='outline'>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  )
}
