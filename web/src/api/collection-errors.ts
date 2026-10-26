import { toApiError } from './errors'

type CollectionQuerySource = 'list' | 'path'

export function isUnavailableCollectionError(
  error: unknown,
  source: CollectionQuerySource,
  page = 0
) {
  const { status } = toApiError(error)

  if (status === 403 || status === 404) return true
  return status === 400 && (source === 'path' || page === 0)
}
