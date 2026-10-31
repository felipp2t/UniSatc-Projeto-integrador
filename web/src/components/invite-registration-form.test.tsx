// @vitest-environment happy-dom

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { renderWithProviders } from '@/test/render'

const { decline, register } = vi.hoisted(() => ({
  decline: vi.fn(),
  register: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    authApi: { ...actual.authApi, register },
    inviteApi: { ...actual.inviteApi, decline },
  }
})

import { InviteRegistrationForm } from './invite-registration-form'

const declineConfirmationButtonName = /^Recusar convite$/

function setup() {
  const onGoToLogin = vi.fn()
  const onRegistered = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()
  const rendered = renderWithProviders(
    <InviteRegistrationForm
      deadline={performance.now() + 60_000}
      email='convidado@example.com'
      onGoToLogin={onGoToLogin}
      onRegistered={onRegistered}
      token='invite-token'
    />
  )
  return { ...rendered, onGoToLogin, onRegistered, user }
}

beforeEach(() => {
  decline.mockReset()
  register.mockReset()
})

afterEach(() => vi.restoreAllMocks())

describe('InviteRegistrationForm', () => {
  it('asks for confirmation and sends only the invite email and token when accepted', async () => {
    decline.mockResolvedValue(undefined)
    const { onRegistered, user } = setup()

    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(
      'Tem certeza de que deseja recusar este convite?'
    )
    await user.click(
      screen.getByRole('button', { name: declineConfirmationButtonName })
    )
    await waitFor(() => expect(decline).toHaveBeenCalledOnce())
    expect(decline).toHaveBeenCalledWith({
      email: 'convidado@example.com',
      token: 'invite-token',
    })
    expect(
      await screen.findByRole('heading', { name: 'Convite recusado' })
    ).toBeTruthy()
    expect(
      screen.getByText(
        'O convite foi recusado. Nenhuma conta ou sessão foi criada.'
      )
    ).toBeTruthy()
    expect(register).not.toHaveBeenCalled()
    expect(onRegistered).not.toHaveBeenCalled()
  })

  it('does not send a request when the invitee cancels confirmation', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(decline).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'CRIAR CONTA' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('blocks registration while the decline request is pending', async () => {
    let resolveDecline: () => void = () => undefined
    decline.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecline = resolve
      })
    )
    const { user } = setup()

    await user.type(screen.getByLabelText('Nome'), 'Ana Exemplo')
    await user.type(screen.getByLabelText('Senha'), 'senha-segura-123')
    await user.type(
      screen.getByLabelText('Confirmar senha'),
      'senha-segura-123'
    )
    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    await user.click(
      screen.getByRole('button', { name: declineConfirmationButtonName })
    )

    const registerButton = screen.getByRole('button', { name: 'CRIAR CONTA' })
    expect(registerButton).toBeDisabled()
    const pendingTrigger = screen.getByRole('button', {
      name: 'Recusando convite…',
    })
    expect(pendingTrigger).toBeDisabled()
    expect(pendingTrigger).toHaveAttribute('aria-busy', 'true')
    await user.click(registerButton)
    expect(register).not.toHaveBeenCalled()

    await act(async () => resolveDecline())
    expect(
      await screen.findByRole('heading', { name: 'Convite recusado' })
    ).toBeTruthy()
  })

  it('shows the unavailable state for an invite that became unavailable', async () => {
    decline.mockRejectedValue(new ApiError('Convite indisponível', 404))
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    await user.click(
      screen.getByRole('button', { name: declineConfirmationButtonName })
    )

    expect(
      await screen.findByRole('heading', { name: 'Convite indisponível' })
    ).toBeTruthy()
    expect(register).not.toHaveBeenCalled()
  })

  it.each([
    [429, {}, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
    [
      undefined,
      { networkError: true },
      'Erro de conexão. Verifique sua internet e tente novamente.',
    ],
    [
      503,
      {},
      'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
    ],
  ])(
    'shows a retryable message for decline failure %s',
    async (status, options, message) => {
      decline.mockRejectedValue(
        new ApiError('failure', status, undefined, undefined, options)
      )
      const { user } = setup()

      await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
      await user.click(
        screen.getByRole('button', { name: declineConfirmationButtonName })
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.getByRole('button', { name: 'CRIAR CONTA' })).toBeTruthy()
      expect(register).not.toHaveBeenCalled()
    }
  )

  it('recovers when the decline is retried after a failure', async () => {
    decline.mockRejectedValueOnce(new ApiError('failure', 503))
    decline.mockResolvedValueOnce(undefined)
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    await user.click(
      screen.getByRole('button', { name: declineConfirmationButtonName })
    )
    expect(await screen.findByRole('alert')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    await user.click(
      screen.getByRole('button', { name: declineConfirmationButtonName })
    )

    expect(
      await screen.findByRole('heading', { name: 'Convite recusado' })
    ).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(decline).toHaveBeenCalledTimes(2)
  })

  it('keeps the declined state when the deadline expires afterwards', async () => {
    decline.mockResolvedValue(undefined)
    let currentTime = 0
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime)
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'RECUSAR CONVITE' }))
    await user.click(
      screen.getByRole('button', { name: declineConfirmationButtonName })
    )
    expect(
      await screen.findByRole('heading', { name: 'Convite recusado' })
    ).toBeTruthy()

    currentTime = 120_000
    act(() => {
      window.dispatchEvent(new Event('pageshow'))
    })

    expect(
      screen.getByRole('heading', { name: 'Convite recusado' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Convite indisponível' })
    ).toBeNull()
  })

  it('uses the destructive variant on the decline trigger', () => {
    setup()

    expect(screen.getByRole('button', { name: 'RECUSAR CONVITE' })).toHaveClass(
      'bg-destructive'
    )
  })

  it('keeps invite acceptance working and completes the existing registration flow', async () => {
    register.mockResolvedValue(undefined)
    const { onRegistered, user } = setup()

    await user.type(screen.getByLabelText('Nome'), 'Ana Exemplo')
    await user.type(screen.getByLabelText('Senha'), 'senha-segura-123')
    await user.type(
      screen.getByLabelText('Confirmar senha'),
      'senha-segura-123'
    )
    await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

    await waitFor(() => expect(register).toHaveBeenCalledOnce())
    expect(register).toHaveBeenCalledWith({
      confirmPassword: 'senha-segura-123',
      email: 'convidado@example.com',
      name: 'Ana Exemplo',
      password: 'senha-segura-123',
      token: 'invite-token',
    })
    expect(onRegistered).toHaveBeenCalledOnce()
    expect(decline).not.toHaveBeenCalled()
  })
})
