import { toApiError } from './errors'
import { isForbiddenOrNotFoundStatus } from './http-status'

type CollectionQuerySource = 'list' | 'path'

export function isUnavailableCollectionError(
  error: unknown,
  source: CollectionQuerySource,
  page = 0
) {
  const { status } = toApiError(error)

  if (isForbiddenOrNotFoundStatus(status)) return true
  return status === 400 && (source === 'path' || page === 0)
}
