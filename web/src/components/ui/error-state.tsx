import { useCallback } from 'react'
import { type ApiError, toApiError } from '@/api/errors'
import { Button } from './button'

export interface ErrorStateProps {
  error?: unknown
  message?: string
  onRetry?: () => void | Promise<void>
  variant?: 'page' | 'compact'
}

function getErrorMessage(apiError: ApiError) {
  if (apiError.isNetworkError) return 'Não foi possível conectar ao servidor.'
  if (apiError.isNotFound) return 'O conteúdo solicitado não foi encontrado.'
  if (apiError.isServerError) return 'O servidor está indisponível no momento.'
  if (apiError.isUnauthorized) return 'Sua sessão não está autorizada.'
  if (apiError.status === undefined) {
    return 'Não foi possível concluir a operação.'
  }
  return apiError.message || 'Não foi possível concluir a operação.'
}

export function ErrorState({
  error,
  message,
  onRetry,
  variant = 'page',
}: ErrorStateProps) {
  const apiError = toApiError(error)
  const isUnknownError =
    !message && apiError.status === undefined && !apiError.isNetworkError

  const handleRetry = useCallback(async () => {
    try {
      await onRetry?.()
    } catch {
      // The operation owner supplies the updated error through props.
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
        {message ?? getErrorMessage(apiError)}
      </p>
      {isUnknownError && import.meta.env.DEV ? (
        <details className='text-muted-foreground text-xs'>
          <summary>Detalhes técnicos</summary>
          <small>{apiError.message}</small>
        </details>
      ) : null}
      {onRetry ? (
        <Button onClick={handleRetry} size='sm' variant='outline'>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  )
}
