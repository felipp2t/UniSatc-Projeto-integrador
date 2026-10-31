import { toApiError } from './errors'

const DEFAULT_NETWORK_MESSAGE =
  'Erro de conexão. Verifique sua internet e tente novamente.'

export const RATE_LIMITED_MESSAGE =
  'Muitas tentativas. Aguarde um pouco e tente novamente.'

export const SERVER_UNAVAILABLE_MESSAGE =
  'Serviço temporariamente indisponível. Tente novamente em alguns instantes.'

export function getApiErrorMessage(
  cause: unknown,
  options: {
    fallback: string
    network?: string
    serverError?: string
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
  if (error.isServerError && options.serverError) return options.serverError
  return options.useServerMessage
    ? error.message || options.fallback
    : options.fallback
}
