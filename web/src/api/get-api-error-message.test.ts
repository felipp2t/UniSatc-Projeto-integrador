import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { getApiErrorMessage } from './get-api-error-message'

const options = {
  fallback: 'Fallback message',
  network: 'Network message',
  statusMessages: { 403: 'Forbidden message' },
}

describe('getApiErrorMessage', () => {
  it('uses a configured HTTP status message before other messages', () => {
    expect(
      getApiErrorMessage(new ApiError('Server message', 403), options)
    ).toBe('Forbidden message')
  })

  it('does not look up a status message when the status is missing', () => {
    expect(
      getApiErrorMessage(new ApiError('Unclassified', undefined), {
        fallback: options.fallback,
        statusMessages: { [-1]: 'Invalid status lookup' },
      })
    ).toBe('Fallback message')
  })

  it('uses the network message for transport errors', () => {
    expect(
      getApiErrorMessage(
        new ApiError('Offline', undefined, undefined, undefined, {
          networkError: true,
        }),
        { fallback: options.fallback }
      )
    ).toBe('Erro de conexão. Verifique sua internet e tente novamente.')
  })

  it('allows a caller to override the default network message', () => {
    expect(
      getApiErrorMessage(
        new ApiError('Offline', undefined, undefined, undefined, {
          networkError: true,
        }),
        options
      )
    ).toBe('Network message')
  })

  it('can prioritize a network error over a mapped HTTP status', () => {
    expect(
      getApiErrorMessage(
        new ApiError('Offline', 409, undefined, undefined, {
          networkError: true,
        }),
        {
          ...options,
          networkFirst: true,
          statusMessages: { 409: 'Conflict message' },
        }
      )
    ).toBe('Network message')
  })

  it('uses the fallback when there is no status or network message', () => {
    expect(getApiErrorMessage(new Error('Unclassified'), options)).toBe(
      'Fallback message'
    )
  })

  it('preserves a server message when the caller requests it', () => {
    expect(
      getApiErrorMessage(new ApiError('Server detail', 500), {
        ...options,
        useServerMessage: true,
      })
    ).toBe('Server detail')
  })
})
