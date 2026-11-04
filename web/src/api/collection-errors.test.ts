import { describe, expect, it } from 'vitest'
import { isUnavailableCollectionError } from './collection-errors'
import { ApiError } from './errors'

describe('isUnavailableCollectionError', () => {
  it.each([403, 404])(
    'treats HTTP %s as an unavailable collection',
    (status) => {
      expect(
        isUnavailableCollectionError(
          new ApiError('Unavailable', status),
          'path'
        )
      ).toBe(true)
      expect(
        isUnavailableCollectionError(
          new ApiError('Unavailable', status),
          'list',
          2
        )
      ).toBe(true)
    }
  )

  it('treats a bad request from the path lookup as unavailable', () => {
    expect(
      isUnavailableCollectionError(new ApiError('Bad request', 400), 'path')
    ).toBe(true)
  })

  it('only treats a first-page list bad request as unavailable', () => {
    const error = new ApiError('Bad request', 400)

    expect(isUnavailableCollectionError(error, 'list', 0)).toBe(true)
    expect(isUnavailableCollectionError(error, 'list', 1)).toBe(false)
  })

  it('does not treat transient failures as unavailable', () => {
    expect(
      isUnavailableCollectionError(new ApiError('Unavailable', 503), 'path')
    ).toBe(false)
  })
})
