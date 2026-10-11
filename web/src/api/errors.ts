import type { InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'

export interface ApiErrorBody {
  error?: string
  message?: string
  path?: string
  status?: number
  timestamp?: string
  [key: string]: unknown
}

export interface ApiErrorOptions {
  canceled?: boolean
  networkError?: boolean
}

export class ApiError extends Error {
  readonly body: unknown
  readonly config: InternalAxiosRequestConfig | undefined
  readonly status: number | undefined
  readonly canceled: boolean
  readonly networkError: boolean

  constructor(
    message: string,
    status?: number,
    body?: unknown,
    config?: InternalAxiosRequestConfig,
    options: ApiErrorOptions = {}
  ) {
    super(message)
    this.name = 'ApiError'
    this.body = body
    this.config = config
    this.status = status
    this.canceled = options.canceled ?? false
    this.networkError = options.networkError ?? false
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isRateLimited() {
    return this.status === 429
  }

  get isCanceled() {
    return this.canceled
  }

  get isNetworkError() {
    return this.networkError
  }

  get isServerError() {
    return this.status !== undefined && this.status >= 500
  }

  get isNotFound() {
    return this.status === 404
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }

  return fallback
}

export function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error
  }

  if (axios.isAxiosError(error)) {
    const body = error.response?.data
    const status = error.response?.status
    const canceled = axios.isCancel(error) || error.code === 'ERR_CANCELED'
    const fallback = error.message || 'Não foi possível comunicar com a API.'

    return new ApiError(
      getErrorMessage(body, fallback),
      status,
      body,
      error.config,
      {
        canceled,
        networkError: !(canceled || error.response),
      }
    )
  }

  if (error instanceof Error) {
    return new ApiError(error.message)
  }

  return new ApiError('Ocorreu um erro inesperado.')
}
