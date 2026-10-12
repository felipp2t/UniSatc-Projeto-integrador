// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import '@/test/dom-setup'
import { ErrorState } from './error-state'

afterEach(() => vi.unstubAllEnvs())

describe('ErrorState', () => {
  it.each([
    [
      'network',
      new AxiosError('offline', 'ERR_NETWORK'),
      'Não foi possível conectar ao servidor.',
    ],
    [
      'not found',
      new ApiError('missing', 404),
      'O conteúdo solicitado não foi encontrado.',
    ],
    [
      'server',
      new ApiError('server', 503),
      'O servidor está indisponível no momento.',
    ],
    ['client', new ApiError('invalid input', 422), 'invalid input'],
  ])('shows the classified %s message', (_, error, message) => {
    render(<ErrorState error={error} />)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })

  it('hides unknown technical details in production', () => {
    vi.stubEnv('DEV', false)
    render(<ErrorState error={new Error('database internals')} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a operação.'
    )
    expect(screen.queryByText('database internals')).not.toBeInTheDocument()
  })

  it('shows unknown technical details in development', () => {
    vi.stubEnv('DEV', true)
    render(<ErrorState error={new Error('database internals')} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a operação.'
    )
    expect(screen.getByText('database internals')).toBeInTheDocument()
  })

  it('renders an accessible retry button only when requested', () => {
    const onRetry = vi.fn()
    const { rerender } = render(<ErrorState message='Falhou' />)
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' })
    ).toBeNull()

    rerender(<ErrorState message='Falhou' onRetry={onRetry} />)
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' })
    ).toBeInTheDocument()
  })

  it.each(['synchronous', 'asynchronous'])(
    'handles a %s retry failure without an unhandled error',
    async (mode) => {
      const onError = vi.fn((event: ErrorEvent) => event.preventDefault())
      window.addEventListener('error', onError)
      const onRetry = vi.fn(() => {
        if (mode === 'synchronous') throw new Error('retry failed')
        return Promise.reject(new Error('retry failed'))
      })
      render(<ErrorState message='Falhou' onRetry={onRetry} />)

      try {
        await userEvent
          .setup()
          .click(screen.getByRole('button', { name: 'Tentar novamente' }))

        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('alert')).toHaveTextContent('Falhou')
        expect(onError).not.toHaveBeenCalled()
      } finally {
        window.removeEventListener('error', onError)
      }
    }
  )
})
