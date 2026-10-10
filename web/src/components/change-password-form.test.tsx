import { FormApi, type revalidateLogic } from '@tanstack/react-form'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { ApiError } from '@/api/errors'

interface PasswordValues {
  confirmPassword: string
  currentPassword: string
  newPassword: string
}

interface FormOptions {
  defaultValues: PasswordValues
  onSubmit: (event: { value: PasswordValues }) => Promise<void>
  validationLogic: ReturnType<typeof revalidateLogic>
  validators: { onDynamic: ZodType<PasswordValues, PasswordValues> }
}

const { captureFormOptions, changePassword, reset, stateSetters } = vi.hoisted(
  () => ({
    captureFormOptions: vi.fn<(options: FormOptions) => void>(),
    changePassword: vi.fn(),
    reset: vi.fn(),
    stateSetters: [] as ReturnType<typeof vi.fn>[],
  })
)

vi.mock('@tanstack/react-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-form')>()
  return {
    ...actual,
    useForm: (options: FormOptions) => {
      captureFormOptions(options)
      return {
        Field: ({
          children,
          name,
        }: {
          children: (field: unknown) => React.ReactNode
          name: string
        }) =>
          children({
            handleBlur: vi.fn(),
            handleChange: vi.fn(),
            name,
            state: {
              meta: { errors: [], isTouched: false, isValid: true },
              value: '',
            },
          }),
        handleSubmit: vi.fn().mockResolvedValue(undefined),
        reset,
        store: {
          canSubmit: true,
          isSubmitting: false,
          values: { newPassword: '' },
        },
      }
    },
    useSelector: (store: unknown, selector: (state: unknown) => unknown) =>
      selector(store),
  }
})

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const setter = vi.fn()
      stateSetters.push(setter)
      return [initial, setter]
    },
  }
})

vi.mock('@/api/endpoints', () => ({
  userApi: { changePassword },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement('button', { type: 'button', ...props }, children),
}))

vi.mock('@/components/ui/field', () => ({
  Field: ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, children),
  FieldError: ({ children }: { children?: React.ReactNode }) =>
    createElement('span', null, children),
  FieldGroup: ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, children),
  FieldLabel: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode
    htmlFor: string
  }) => createElement('label', { htmlFor }, children),
}))

vi.mock('@/components/ui/secret-input', () => ({
  SecretInput: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    createElement('input', props),
}))

import { ChangePasswordForm } from './change-password-form'

function renderForm() {
  renderToString(createElement(ChangePasswordForm))
  const options = captureFormOptions.mock.lastCall?.[0]
  if (!options) {
    throw new Error('The form options were not captured')
  }

  return options
}

function createFormApi(options: FormOptions) {
  return new FormApi(options)
}

beforeEach(() => {
  captureFormOptions.mockClear()
  changePassword.mockReset()
  reset.mockReset()
  stateSetters.length = 0
})

describe('change password form', () => {
  it('validates required fields, minimum length, and exact confirmation without trimming', () => {
    const { validators } = renderForm()

    expect(() =>
      validators.onDynamic.parse({
        confirmPassword: 'password',
        currentPassword: '',
        newPassword: 'password',
      })
    ).toThrow('Informe sua senha atual.')
    expect(() =>
      validators.onDynamic.parse({
        confirmPassword: 'short',
        currentPassword: 'current-password',
        newPassword: 'short',
      })
    ).toThrow('A nova senha deve ter pelo menos 8 caracteres.')
    expect(() =>
      validators.onDynamic.parse({
        confirmPassword: 'different-password',
        currentPassword: 'current-password',
        newPassword: 'new-password',
      })
    ).toThrow('As senhas não coincidem.')

    expect(
      validators.onDynamic.parse({
        confirmPassword: ' weakpass ',
        currentPassword: ' current password ',
        newPassword: ' weakpass ',
      })
    ).toEqual({
      confirmPassword: ' weakpass ',
      currentPassword: ' current password ',
      newPassword: ' weakpass ',
    })
  })

  it('allows an invalid submission to be corrected, then submits the original values and resets', async () => {
    const form = createFormApi(renderForm())
    form.setFieldValue('currentPassword', ' current password ')
    form.setFieldValue('newPassword', 'short')
    form.setFieldValue('confirmPassword', 'short')

    await form.handleSubmit()
    expect(form.state.canSubmit).toBe(false)
    expect(changePassword).not.toHaveBeenCalled()

    const value = {
      confirmPassword: ' weakpass ',
      currentPassword: ' current password ',
      newPassword: ' weakpass ',
    }
    form.setFieldValue('newPassword', value.newPassword)
    form.setFieldValue('confirmPassword', value.confirmPassword)

    expect(form.state.canSubmit).toBe(true)
    changePassword.mockResolvedValue(undefined)
    await form.handleSubmit()

    expect(changePassword).toHaveBeenCalledOnce()
    expect(changePassword).toHaveBeenCalledWith(value)
    expect(reset).toHaveBeenCalledOnce()
    expect(stateSetters[1]).toHaveBeenLastCalledWith(true)
  })

  it('shows the API error and keeps values after a failed change', async () => {
    const options = renderForm()
    const value = {
      confirmPassword: 'new-password',
      currentPassword: 'wrong-password',
      newPassword: 'new-password',
    }
    changePassword.mockRejectedValue(new ApiError('Senha atual incorreta', 400))

    await options.onSubmit({ value })

    expect(changePassword).toHaveBeenCalledWith(value)
    expect(reset).not.toHaveBeenCalled()
    expect(stateSetters[0]).toHaveBeenLastCalledWith('Senha atual incorreta')
  })
})
