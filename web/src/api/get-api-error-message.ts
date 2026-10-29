import { toApiError } from './errors'

const DEFAULT_NETWORK_MESSAGE =
  'Erro de conexão. Verifique sua internet e tente novamente.'

export function getApiErrorMessage(
  cause: unknown,
  options: {
    fallback: string
    network?: string
    statusMessages?: Record<number, string>
    useServerMessage?: boolean
  }
) {
  const error = toApiError(cause)
  const statusMessage =
    error.status === undefined
      ? undefined
      : options.statusMessages?.[error.status]
  if (statusMessage) return statusMessage
  if (error.isNetworkError) {
    return options.network ?? DEFAULT_NETWORK_MESSAGE
  }
  return options.useServerMessage
    ? error.message || options.fallback
    : options.fallback
}
