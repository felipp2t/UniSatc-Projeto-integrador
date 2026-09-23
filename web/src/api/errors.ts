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

export class ApiError extends Error {
  readonly body: unknown
  readonly config: InternalAxiosRequestConfig | undefined
  readonly status: number | undefined

  constructor(
    message: string,
    status?: number,
    body?: unknown,
    config?: InternalAxiosRequestConfig
  ) {
    super(message)
    this.name = 'ApiError'
    this.body = body
    this.config = config
    this.status = status
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isRateLimited() {
    return this.status === 429
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
    const fallback = error.message || 'Não foi possível comunicar com a API.'

    return new ApiError(
      getErrorMessage(body, fallback),
      status,
      body,
      error.config
    )
  }

  if (error instanceof Error) {
    return new ApiError(error.message)
  }

  return new ApiError('Ocorreu um erro inesperado.')
}
