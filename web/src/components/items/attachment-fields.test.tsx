// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@/test/dom-setup'
import { AttachmentFields } from '@/components/items/attachment-fields'

afterEach(cleanup)

describe('AttachmentFields', () => {
  const props = {
    description: '',
    file: undefined,
    id: 'x',
    onDescriptionChange: () => undefined,
    onFileChange: () => undefined,
  }

  it('renders the error and links it to the file input', () => {
    render(<AttachmentFields {...props} error='Selecione um arquivo.' />)

    expect(screen.getByRole('alert')).toHaveTextContent('Selecione um arquivo.')
    const input = screen.getByLabelText('ARQUIVO')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'x-file-error')
  })

  it('renders no alert without an error', () => {
    render(<AttachmentFields {...props} />)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('ARQUIVO')).not.toHaveAttribute('aria-invalid')
  })
})
