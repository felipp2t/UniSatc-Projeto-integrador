// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/test/dom-setup'
import { ATTACHMENT_HINT } from '@/lib/item-validation'
import { FileInput } from './file-input'

const SIZE_IN_KB = /1 KB/

afterEach(cleanup)

describe('FileInput', () => {
  it('shows ATTACHMENT_HINT by default while empty', () => {
    render(<FileInput />)
    expect(screen.getByText(ATTACHMENT_HINT)).toBeInTheDocument()
  })

  it('shows the custom hint while empty', () => {
    render(<FileInput hint='PDF até 20 MB' />)
    expect(screen.getByText('PDF até 20 MB')).toBeInTheDocument()
  })

  it('shows the file name and a readable size', () => {
    const file = new File(['abc'], 'policy.pdf', { type: 'application/pdf' })
    render(<FileInput value={file} />)
    expect(screen.getByText('policy.pdf')).toBeInTheDocument()
    expect(screen.getByText(SIZE_IN_KB)).toBeInTheDocument()
  })

  it('marks the input invalid only when requested', () => {
    const { container, rerender } = render(<FileInput />)
    expect(container.querySelector('input')).not.toHaveAttribute('aria-invalid')
    rerender(<FileInput isInvalid />)
    expect(container.querySelector('input')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('accepts a dropped file and highlights while dragging over', () => {
    const onChange = vi.fn()
    const file = new File(['abc'], 'notes.txt')
    const { container } = render(<FileInput onChange={onChange} />)
    const zone = container.firstElementChild as HTMLElement

    fireEvent.dragOver(zone)
    expect(screen.getByText('SOLTE PARA ANEXAR')).toBeInTheDocument()
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    expect(onChange).toHaveBeenCalledWith(file)
    expect(screen.queryByText('SOLTE PARA ANEXAR')).not.toBeInTheDocument()
  })

  it('ignores dropped files when disabled', () => {
    const onChange = vi.fn()
    const { container } = render(<FileInput disabled onChange={onChange} />)
    fireEvent.drop(container.firstElementChild as HTMLElement, {
      dataTransfer: { files: [new File(['abc'], 'notes.txt')] },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the displayed file when value becomes null', () => {
    const file = new File(['abc'], 'policy.pdf', { type: 'application/pdf' })
    const { rerender } = render(<FileInput value={file} />)
    expect(screen.getByText('policy.pdf')).toBeInTheDocument()

    rerender(<FileInput hint='Escolha um arquivo' value={null} />)

    expect(screen.queryByText('policy.pdf')).toBeNull()
    expect(screen.getByText('Escolha um arquivo')).toBeInTheDocument()
  })
})
