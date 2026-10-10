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
  logout: () => Promise<void>
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
  private initializationId = 0

  constructor() {
    this.interceptorId = installAuthInterceptor(apiClient, {
      onSessionExpired: () => this.handleSessionExpired(),
      refresh: async (_failedRequest: ApiError) => {
        await authApi.refresh()
        return true
      },
    })
  }

  initialize(force = false): Promise<void> {
    if (force && !this.initializing) {
      this.initialization = undefined
      this.status = 'loading'
      this.expirationHandled = false
    }

    if (this.initialization) {
      return this.initialization
    }

    this.initializing = true
    this.initializationId += 1
    const { initializationId } = this
    const initialization = userApi
      .getMe()
      .then(({ data }) => {
        if (initializationId !== this.initializationId) {
          return
        }

        this.user = data
        this.status = 'authenticated'
        this.expirationHandled = false
      })
      .catch((error: unknown) => {
        if (initializationId !== this.initializationId) {
          return
        }

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
        if (initializationId === this.initializationId) {
          this.initializing = false
        }
      })

    this.initialization = initialization
    return initialization
  }

  async logout() {
    try {
      await authApi.logout()
    } catch (error) {
      if (!toApiError(error).isUnauthorized) {
        throw error
      }
    }

    this.resetSession()
  }

  setNavigateToLogin(navigate: () => void) {
    this.navigateToLogin = navigate
  }

  handleSessionExpired() {
    if (this.expirationHandled) {
      return
    }

    const wasInitializing = this.initializing
    this.resetSession()

    if (!wasInitializing) {
      this.navigateToLogin?.()
    }
  }

  private resetSession() {
    this.initializationId += 1
    this.initialization = undefined
    this.initializing = false
    this.user = undefined
    this.status = 'unauthenticated'
    this.expirationHandled = true
  }

  dispose() {
    apiClient.interceptors.response.eject(this.interceptorId)
  }
}

export function createSessionService(): SessionService {
  return new SessionServiceImpl()
}
