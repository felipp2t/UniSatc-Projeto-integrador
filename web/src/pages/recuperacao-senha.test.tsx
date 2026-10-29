// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { createQueryClient } from '@/api/query-client'
import type { SessionService } from '@/auth/session'
import { renderWithProviders } from '@/test/render'
import { routeTree } from '../route-tree.gen'

const { forgotPassword, login, resetPassword, successToast } = vi.hoisted(
  () => ({
    forgotPassword: vi.fn(),
    login: vi.fn(),
    resetPassword: vi.fn(),
    successToast: vi.fn(),
  })
)

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    authApi: { ...actual.authApi, forgotPassword, login, resetPassword },
  }
})

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return {
    ...actual,
    appToast: { ...actual.appToast, success: successToast },
  }
})

function createSession(): SessionService {
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn(),
    logout: vi.fn(),
    setNavigateToLogin: vi.fn(),
    status: 'unauthenticated',
    updateUser: vi.fn(),
    user: undefined,
  } as SessionService
}

async function renderPage(entry: string) {
  const session = createSession()
  const queryClient = createQueryClient()
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session,
    },
    history: createMemoryHistory({ initialEntries: [entry] }),
    isServer: false,
    routeTree,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  router.updateLatestLocation()
  await router.load({ sync: true })
  const rendered = renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
  return { ...rendered, router, session }
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('solicitação de recuperação de senha', () => {
  it.each(['conta@example.com', 'inexistente@example.com'])(
    'exibe a mesma mensagem genérica para %s',
    async (email) => {
      forgotPassword.mockResolvedValue(undefined)
      const user = userEvent.setup()
      await renderPage('/esqueci-senha')

      await user.type(screen.getByLabelText('E-mail'), email)
      await user.click(
        screen.getByRole('button', { name: 'Enviar orientações' })
      )

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Se houver uma conta com esse e-mail, você receberá orientações para redefinir a senha.'
      )
      expect(forgotPassword).toHaveBeenCalledWith({ email })
    }
  )

  it('does not send an invalid email and offers the login link', async () => {
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')

    await user.type(screen.getByLabelText('E-mail'), 'inválido')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy()
    expect(forgotPassword).not.toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: 'Voltar ao login' })
    ).toHaveAttribute('href', '/login')
  })

  it('allows correcting an invalid email and submitting again', async () => {
    forgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')
    const email = screen.getByLabelText('E-mail')

    await user.type(email, 'inválido')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy()

    await user.clear(email)
    await user.type(email, 'conta@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se houver uma conta com esse e-mail, você receberá orientações para redefinir a senha.'
    )
    expect(forgotPassword).toHaveBeenCalledOnce()
  })

  it.each([
    [429, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
    [
      500,
      'Não foi possível solicitar a redefinição agora. Verifique sua conexão e tente novamente.',
    ],
  ])('shows a recoverable message for HTTP %i', async (status, message) => {
    forgotPassword.mockRejectedValue(new ApiError('falha', status))
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')

    await user.type(screen.getByLabelText('E-mail'), 'conta@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})

describe('redefinição de senha', () => {
  it.each(['/redefinir-senha', '/redefinir-senha?token='])(
    'offers a new request when token is missing in %s',
    async (entry) => {
      await renderPage(entry)

      expect(
        await screen.findByRole('heading', { name: 'Link indisponível' })
      ).toBeTruthy()
      expect(
        screen.getByRole('link', { name: 'Solicitar novo link' })
      ).toHaveAttribute('href', '/esqueci-senha')
      expect(resetPassword).not.toHaveBeenCalled()
    }
  )

  it('offers a new request for an unavailable link returned as HTTP 401', async () => {
    resetPassword.mockRejectedValue(new ApiError('link indisponível', 401))
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    await user.type(screen.getByLabelText('Nova senha'), 'senha forte')
    await user.type(screen.getByLabelText('Confirme a senha'), 'senha forte')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(
      await screen.findByRole('heading', { name: 'Link indisponível' })
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Solicitar novo link' })
    ).toBeTruthy()
  })

  it('validates minimum length and exact confirmation before sending', async () => {
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    await user.type(screen.getByLabelText('Nova senha'), 'curta')
    await user.type(screen.getByLabelText('Confirme a senha'), 'diferente')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy()
    expect(screen.getByText('As senhas devem ser iguais.')).toBeTruthy()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('allows correcting invalid passwords and submitting again', async () => {
    resetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')
    const newPassword = screen.getByLabelText('Nova senha')
    const confirmPassword = screen.getByLabelText('Confirme a senha')

    await user.type(newPassword, 'curta')
    await user.type(confirmPassword, 'diferente')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy()

    await user.clear(newPassword)
    await user.clear(confirmPassword)
    await user.type(newPassword, 'senha forte')
    await user.type(confirmPassword, 'senha forte')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce())
    expect(resetPassword).toHaveBeenCalledWith({
      confirmPassword: 'senha forte',
      newPassword: 'senha forte',
      token: 'token-atual',
    })
  })

  it('preserves password characters and goes to login without a redirect after success', async () => {
    resetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { router, session } = await renderPage(
      '/redefinir-senha?token=token-atual'
    )

    await user.type(screen.getByLabelText('Nova senha'), ' senha123 ')
    await user.type(screen.getByLabelText('Confirme a senha'), ' senha123 ')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce())
    expect(resetPassword).toHaveBeenCalledWith({
      confirmPassword: ' senha123 ',
      newPassword: ' senha123 ',
      token: 'token-atual',
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual({ redirect: undefined })
    expect(session.handleSessionExpired).toHaveBeenCalledOnce()
    expect(session.initialize).not.toHaveBeenCalled()
    expect(successToast).toHaveBeenCalledWith(
      'Senha redefinida. Entre novamente com sua nova senha.'
    )
  })

  it.each([
    [429, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
    [
      500,
      'Não foi possível redefinir a senha agora. Verifique sua conexão e tente novamente.',
    ],
  ])('shows a recoverable message for HTTP %i', async (status, message) => {
    resetPassword.mockRejectedValue(new ApiError('falha', status))
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    await user.type(screen.getByLabelText('Nova senha'), 'senha forte')
    await user.type(screen.getByLabelText('Confirme a senha'), 'senha forte')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})

describe('login', () => {
  it('links to the existing password recovery page', async () => {
    await renderPage('/login')

    expect(
      screen.getByRole('link', { name: 'Esqueceu a senha?' })
    ).toHaveAttribute('href', '/esqueci-senha')
  })

  it('toggles the password visibility with the eye button', async () => {
    const user = userEvent.setup()
    await renderPage('/login')
    const password = screen.getByLabelText('Senha')

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar conteúdo' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar conteúdo' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})
