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

  it('uses a mapped HTTP status message', () => {
    expect(
      getApiErrorMessage(new ApiError('Conflict', 409), {
        ...options,
        statusMessages: { 409: 'Conflict message' },
      })
    ).toBe('Conflict message')
  })

  it('uses the fallback when there is no status or network message', () => {
    expect(getApiErrorMessage(new Error('Unclassified'), options)).toBe(
      'Fallback message'
    )
  })

  it('uses the server error message for 5xx responses when configured', () => {
    expect(
      getApiErrorMessage(new ApiError('Server detail', 503), {
        ...options,
        serverError: 'Server error message',
      })
    ).toBe('Server error message')
  })

  it.each([500, 502, 503, 504])(
    'uses the server error message for HTTP %i',
    (status) => {
      expect(
        getApiErrorMessage(new ApiError('Server detail', status), {
          ...options,
          serverError: 'Server error message',
        })
      ).toBe('Server error message')
    }
  )

  it('keeps exact 429 and 400 status messages when a server error message is set', () => {
    const configured = {
      ...options,
      serverError: 'Server error message',
      statusMessages: { 400: 'Bad request message', 429: 'Rate limit message' },
    }

    expect(getApiErrorMessage(new ApiError('x', 429), configured)).toBe(
      'Rate limit message'
    )
    expect(getApiErrorMessage(new ApiError('x', 400), configured)).toBe(
      'Bad request message'
    )
  })

  it('does not treat HTTP 499 as a server error', () => {
    expect(
      getApiErrorMessage(new ApiError('x', 499), {
        ...options,
        serverError: 'Server error message',
      })
    ).toBe('Fallback message')
  })

  it('prefers an exact status message over the server error message', () => {
    expect(
      getApiErrorMessage(new ApiError('Server detail', 503), {
        ...options,
        serverError: 'Server error message',
        statusMessages: { 503: 'Exact status message' },
      })
    ).toBe('Exact status message')
  })

  it('falls back on 5xx responses without a server error message', () => {
    expect(
      getApiErrorMessage(new ApiError('Server detail', 503), options)
    ).toBe('Fallback message')
  })

  it('does not use the server error message for client errors or network failures', () => {
    expect(
      getApiErrorMessage(new ApiError('Unauthorized', 401), {
        ...options,
        serverError: 'Server error message',
      })
    ).toBe('Fallback message')
    expect(
      getApiErrorMessage(
        new ApiError('Offline', undefined, undefined, undefined, {
          networkError: true,
        }),
        { ...options, serverError: 'Server error message' }
      )
    ).toBe('Network message')
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
