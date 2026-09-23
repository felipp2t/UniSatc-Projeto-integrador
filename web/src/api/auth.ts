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
        const refreshed = await options.refresh(apiError)
        if (!refreshed) {
          options.onSessionExpired?.()
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
        options.onSessionExpired?.()
        return Promise.reject(toApiError(refreshError))
      }
    }
  )
}
