// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@/test/dom-setup'
import { UploadProgress } from '@/components/items/upload-progress'

afterEach(cleanup)

describe('UploadProgress', () => {
  it('shows the default label with the percentage', () => {
    render(<UploadProgress progress={43} />)

    expect(screen.getByText('Envio: 43%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveValue(43)
  })

  it('shows a custom label and children', () => {
    render(
      <UploadProgress label='72%' progress={72}>
        <p>extra</p>
      </UploadProgress>
    )

    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.queryByText('Envio: 72%')).toBeNull()
    expect(screen.getByText('extra')).toBeInTheDocument()
  })
})
