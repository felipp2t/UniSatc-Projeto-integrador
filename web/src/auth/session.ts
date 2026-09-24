import { installAuthInterceptor } from '@/api/auth'
import { apiClient } from '@/api/client'
import { authApi, userApi } from '@/api/endpoints'
import { type ApiError, toApiError } from '@/api/errors'
import type { UserResponse } from '@/api/types'

export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'

export interface SessionService {
  dispose: () => void
  handleSessionExpired: () => void
  initialize: (force?: boolean) => Promise<void>
  setNavigateToLogin: (navigate: () => void) => void
  readonly status: SessionStatus
  readonly user: UserResponse | undefined
}

class SessionServiceImpl implements SessionService {
  status: SessionStatus = 'loading'
  user: UserResponse | undefined

  private initialization: Promise<void> | undefined
  private navigateToLogin: (() => void) | undefined
  private readonly interceptorId: number
  private expirationHandled: boolean | undefined
  private initializing: boolean | undefined

  constructor() {
    this.interceptorId = installAuthInterceptor(apiClient, {
      onSessionExpired: () => this.handleSessionExpired(),
      refresh: async (_failedRequest: ApiError) => {
        await authApi.refresh()
        return true
      },
    })
  }

  initialize(force = false) {
    if (force && !this.initializing) {
      this.initialization = undefined
      this.status = 'loading'
      this.expirationHandled = false
    }

    if (this.initialization) {
      return this.initialization
    }

    this.initializing = true
    this.initialization = userApi
      .getMe()
      .then(({ data }) => {
        this.user = data
        this.status = 'authenticated'
        this.expirationHandled = false
      })
      .catch((error: unknown) => {
        const apiError = toApiError(error)
        if (apiError.isUnauthorized) {
          this.user = undefined
          this.status = 'unauthenticated'
          this.initialization = undefined
          return
        }

        this.status = 'error'
        this.initialization = undefined
        throw error
      })
      .finally(() => {
        this.initializing = false
      })

    return this.initialization
  }

  setNavigateToLogin(navigate: () => void) {
    this.navigateToLogin = navigate
  }

  handleSessionExpired() {
    if (this.expirationHandled) {
      return
    }

    this.expirationHandled = true
    this.user = undefined
    this.status = 'unauthenticated'
    this.initialization = undefined
    if (!this.initializing) {
      this.navigateToLogin?.()
    }
  }

  dispose() {
    apiClient.interceptors.response.eject(this.interceptorId)
  }
}

export function createSessionService(): SessionService {
  return new SessionServiceImpl()
}
