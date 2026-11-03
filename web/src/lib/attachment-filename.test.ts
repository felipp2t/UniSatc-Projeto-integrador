import { describe, expect, it } from 'vitest'
import { attachmentFilename } from './attachment-filename'

describe('attachmentFilename', () => {
  it('decodes filename* with UTF-8 encoding', () => {
    expect(
      attachmentFilename(
        "attachment; filename*=UTF-8''pol%C3%ADtica%20final.pdf",
        'Título'
      )
    ).toBe('política final.pdf')
  })

  it('prefers filename* over filename', () => {
    expect(
      attachmentFilename(
        `attachment; filename="fallback.pdf"; filename*=UTF-8''real.pdf`,
        'Título'
      )
    ).toBe('real.pdf')
  })

  it('reads a quoted filename', () => {
    expect(
      attachmentFilename('attachment; filename="my file.pdf"', 'Título')
    ).toBe('my file.pdf')
  })

  it('reads an unquoted filename', () => {
    expect(
      attachmentFilename('attachment; filename=report.pdf', 'Título')
    ).toBe('report.pdf')
  })

  it('falls back to plain filename when filename* cannot be decoded', () => {
    expect(
      attachmentFilename(
        `attachment; filename*=UTF-8''%E0%A4%A; filename="plain.pdf"`,
        'Título'
      )
    ).toBe('plain.pdf')
  })

  it('falls back to the title when the encoding is invalid and no plain name exists', () => {
    expect(
      attachmentFilename(`attachment; filename*=UTF-8''%E0%A4%A`, 'Título')
    ).toBe('Título')
  })

  it('falls back to the title without a usable name', () => {
    expect(attachmentFilename(undefined, 'Título')).toBe('Título')
    expect(attachmentFilename('attachment', 'Título')).toBe('Título')
    expect(attachmentFilename('attachment; filename=""', 'Título')).toBe(
      'Título'
    )
  })

  it('falls back to the title when the disposition is not a string', () => {
    expect(attachmentFilename(undefined, 'Título')).toBe('Título')
    expect(attachmentFilename(42, 'Título')).toBe('Título')
    expect(attachmentFilename(null, 'Título')).toBe('Título')
  })
})
