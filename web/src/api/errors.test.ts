import { AxiosError } from 'axios'
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
