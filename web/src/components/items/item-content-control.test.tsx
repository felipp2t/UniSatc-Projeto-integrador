// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ItemContentField } from '@/components/items/item-content-control'
import '@/test/dom-setup'

function renderField(
  type: 'link' | 'secret' | 'text',
  props: { invalid?: boolean; value?: string } = {}
) {
  const onChange = vi.fn()
  render(
    <ItemContentField
      id='content'
      invalid={props.invalid ?? false}
      onChange={onChange}
      type={type}
      value={props.value ?? ''}
    />
  )
  return onChange
}

describe('ItemContentField', () => {
  it('rotula e limita cada tipo', () => {
    renderField('text')
    expect(screen.getByLabelText('CONTEÚDO')).toHaveAttribute(
      'maxlength',
      '100000'
    )
  })

  it('link usa input url com limite de 2048', () => {
    renderField('link')
    const input = screen.getByLabelText('URL')
    expect(input).toHaveAttribute('type', 'url')
    expect(input).toHaveAttribute('maxlength', '2048')
  })

  it('segredo é mascarado, limitado a 8192 e pode ser revelado', async () => {
    const user = userEvent.setup()
    renderField('secret', { value: 'abc' })
    const input = screen.getByLabelText('VALOR DO SEGREDO')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('maxlength', '8192')

    await user.click(screen.getByRole('button', { name: 'Mostrar conteúdo' }))

    expect(input).toHaveAttribute('type', 'text')
  })

  it('propaga a alteração sem modificar o valor', () => {
    const onChange = renderField('secret')

    fireEvent.change(screen.getByLabelText('VALOR DO SEGREDO'), {
      target: { value: '  espaço  ' },
    })

    expect(onChange).toHaveBeenCalledWith('  espaço  ')
  })

  it('exibe mensagem específica de link inválido em alerta', () => {
    renderField('link', { invalid: true })

    expect(screen.getByRole('alert')).toHaveTextContent('http:// ou https://')
    expect(screen.getByLabelText('URL')).toHaveAttribute('aria-invalid', 'true')
  })

  it('exibe mensagem genérica para texto inválido', () => {
    renderField('text', { invalid: true })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe o conteúdo do item.'
    )
  })
})
