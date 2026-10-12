import axios, { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, toApiError } from './errors'

describe('ApiError', () => {
  it('classifies network and cancellation errors from Axios', () => {
    const network = toApiError(new AxiosError('offline', 'ERR_NETWORK'))
    const canceled = toApiError(new AxiosError('canceled', 'ERR_CANCELED'))

    expect(network.isNetworkError).toBe(true)
    expect(network.isCanceled).toBe(false)
    expect(canceled.isCanceled).toBe(true)
    expect(canceled.isNetworkError).toBe(false)
  })

  it('exposes status classifications', () => {
    expect(new ApiError('not found', 404).isNotFound).toBe(true)
    expect(new ApiError('server', 503).isServerError).toBe(true)
    expect(new ApiError('client', 400).isServerError).toBe(false)
  })

  it.each(['ECONNABORTED', 'ETIMEDOUT'])(
    'classifies %s as a transport error',
    (code) => {
      expect(toApiError(new AxiosError('timeout', code)).isNetworkError).toBe(
        true
      )
    }
  )

  it.each([
    'ERR_BAD_OPTION',
    'ERR_BAD_OPTION_VALUE',
    'ERR_INVALID_URL',
    'ERR_NOT_SUPPORT',
    undefined,
  ])('does not classify %s as a transport error', (code) => {
    const error = toApiError(new AxiosError('invalid configuration', code))
    expect(error.isNetworkError).toBe(false)
    expect(error.isCanceled).toBe(false)
  })

  it('does not classify a real configuration failure as a network error', async () => {
    const request = axios.get('/unused', {
      // @ts-expect-error Deliberately invalid configuration to exercise Axios validation.
      transitional: { silentJSONParsing: 'invalid' },
    })

    await expect(request.catch(toApiError)).resolves.toMatchObject({
      message: 'option silentJSONParsing must be a boolean',
      networkError: false,
    })
  })

  it('preserves regular Axios responses', () => {
    const error = new AxiosError('bad request', 'ERR_BAD_REQUEST')
    error.response = {
      config: {} as never,
      data: { message: 'invalid' },
      headers: {},
      status: 400,
      statusText: 'Bad Request',
    }

    const apiError = toApiError(error)
    expect(apiError.status).toBe(400)
    expect(apiError.isNetworkError).toBe(false)
    expect(apiError.message).toBe('invalid')
  })
})
