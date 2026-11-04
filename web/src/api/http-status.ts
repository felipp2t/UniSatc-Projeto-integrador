import { toApiError } from './errors'

export function isForbiddenOrNotFound(error: unknown) {
  return isForbiddenOrNotFoundStatus(toApiError(error).status)
}

export function isForbiddenOrNotFoundStatus(status: number | undefined) {
  return status === 403 || status === 404
}
