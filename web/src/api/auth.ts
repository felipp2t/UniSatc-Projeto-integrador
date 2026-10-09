import type { AxiosInstance } from 'axios'

import { apiClient } from './client'
import { type ApiError, toApiError } from './errors'

declare module 'axios' {
  // biome-ignore lint/suspicious/noExplicitAny: match AxiosRequestConfig's generic defaults for declaration merging.
  interface AxiosRequestConfig<D = any, P = any> {
    authRetry?: boolean
  }
}

export interface AuthInterceptorOptions {
  onSessionExpired?: () => void
  refresh?: (failedRequest: ApiError) => Promise<boolean>
}

export const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/auth/forgot-password',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/register',
  '/auth/reset-password',
] as const

const AUTH_URL_SUFFIX_SEPARATOR = /[?#]/

export function shouldSkipAuthRefresh(url?: string) {
  if (!url) {
    return false
  }

  const [path] = url.split(AUTH_URL_SUFFIX_SEPARATOR)

  return AUTH_ENDPOINTS_WITHOUT_REFRESH.some((endpoint) =>
    path.endsWith(endpoint)
  )
}

export function installAuthInterceptor(
  client: AxiosInstance = apiClient,
  options: AuthInterceptorOptions = {}
) {
  let refreshPromise: Promise<boolean> | undefined

  const refreshSession = (failedRequest: ApiError) => {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve()
        .then(() => options.refresh?.(failedRequest) ?? false)
        .then(
          (refreshed) => {
            if (!refreshed) {
              options.onSessionExpired?.()
            }
            return refreshed
          },
          (refreshError) => {
            const apiError = toApiError(refreshError)
            if (apiError.isUnauthorized) {
              options.onSessionExpired?.()
            }
            throw apiError
          }
        )
        .finally(() => {
          refreshPromise = undefined
        })
    }

    return refreshPromise
  }

  return client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const apiError = toApiError(error)
      const { config } = apiError

      if (
        !(apiError.isUnauthorized && config) ||
        config.authRetry ||
        shouldSkipAuthRefresh(config.url) ||
        !options.refresh
      ) {
        return Promise.reject(apiError)
      }

      config.authRetry = true

      try {
        const refreshed = await refreshSession(apiError)
        if (!refreshed) {
          return Promise.reject(apiError)
        }

        try {
          return await client.request(config)
        } catch (retryError) {
          const retryApiError = toApiError(retryError)
          if (retryApiError.isUnauthorized) {
            options.onSessionExpired?.()
          }
          return Promise.reject(retryApiError)
        }
      } catch (refreshError) {
        return Promise.reject(toApiError(refreshError))
      }
    }
  )
}
