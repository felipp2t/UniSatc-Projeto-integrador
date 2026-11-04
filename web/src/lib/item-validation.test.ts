import { describe, expect, it } from 'vitest'
import {
  DESCRIPTION_MAX,
  FILE_MAX_BYTES,
  isContentInvalid,
  isDescriptionInvalid,
  isHttpUrl,
  isTitleInvalid,
  SECRET_MAX,
  TEXT_MAX,
  TITLE_MAX,
  URL_MAX,
  validateAttachmentFile,
} from './item-validation'

function fileOf(name: string, size: number) {
  const file = new File([], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function urlOfLength(length: number) {
  const prefix = 'https://example.com/'
  return prefix + 'a'.repeat(length - prefix.length)
}

describe('isTitleInvalid', () => {
  it('aceita 255 caracteres e rejeita 256', () => {
    expect(isTitleInvalid('a'.repeat(TITLE_MAX))).toBe(false)
    expect(isTitleInvalid('a'.repeat(TITLE_MAX + 1))).toBe(true)
  })

  it('rejeita título vazio ou só com espaços e apara antes de medir', () => {
    expect(isTitleInvalid('')).toBe(true)
    expect(isTitleInvalid('   ')).toBe(true)
    expect(isTitleInvalid(` ${'a'.repeat(TITLE_MAX)} `)).toBe(false)
  })
})

describe('isDescriptionInvalid', () => {
  it('aceita 2000 caracteres e rejeita 2001', () => {
    expect(isDescriptionInvalid('a'.repeat(DESCRIPTION_MAX))).toBe(false)
    expect(isDescriptionInvalid('a'.repeat(DESCRIPTION_MAX + 1))).toBe(true)
  })

  it('aceita descrição vazia', () => {
    expect(isDescriptionInvalid('')).toBe(false)
  })
})

describe('isContentInvalid', () => {
  it('texto: aceita 100000 e rejeita 100001', () => {
    expect(isContentInvalid('text', 'a'.repeat(TEXT_MAX))).toBe(false)
    expect(isContentInvalid('text', 'a'.repeat(TEXT_MAX + 1))).toBe(true)
  })

  it('texto, segredo e link só com espaços são inválidos', () => {
    expect(isContentInvalid('text', '   \n ')).toBe(true)
    expect(isContentInvalid('secret', '    ')).toBe(true)
    expect(isContentInvalid('link', '   ')).toBe(true)
  })

  it('segredo: aceita 8192 e rejeita 8193', () => {
    expect(isContentInvalid('secret', 'a'.repeat(SECRET_MAX))).toBe(false)
    expect(isContentInvalid('secret', 'a'.repeat(SECRET_MAX + 1))).toBe(true)
  })

  it('segredo com espaços nas pontas é válido e não é aparado na medição', () => {
    expect(isContentInvalid('secret', '  senha com espaço  ')).toBe(false)
    expect(isContentInvalid('secret', ` ${'a'.repeat(SECRET_MAX)}`)).toBe(true)
  })

  it('link: aceita 2048 e rejeita 2049 caracteres', () => {
    expect(isContentInvalid('link', urlOfLength(URL_MAX))).toBe(false)
    expect(isContentInvalid('link', urlOfLength(URL_MAX + 1))).toBe(true)
  })

  it('link: exige http ou https', () => {
    expect(isContentInvalid('link', 'ftp://example.com/a')).toBe(true)
    expect(isContentInvalid('link', 'javascript:alert(1)')).toBe(true)
    expect(isContentInvalid('link', 'example.com')).toBe(true)
    expect(isContentInvalid('link', 'http://example.com')).toBe(false)
    expect(isContentInvalid('link', ' https://example.com ')).toBe(false)
  })
})

describe('isHttpUrl', () => {
  it('rejeita url sem host e texto livre', () => {
    expect(isHttpUrl('http://')).toBe(false)
    expect(isHttpUrl('não é url')).toBe(false)
    expect(isHttpUrl('https://exemplo.com')).toBe(true)
  })
})

describe('validateAttachmentFile', () => {
  it('define o limite em 20.000.000 bytes', () => {
    expect(FILE_MAX_BYTES).toBe(20_000_000)
  })

  it('aceita 20.000.000 bytes e rejeita 20.000.001', () => {
    expect(
      validateAttachmentFile(fileOf('a.pdf', FILE_MAX_BYTES))
    ).toBeUndefined()
    expect(validateAttachmentFile(fileOf('a.pdf', FILE_MAX_BYTES + 1))).toBe(
      'O arquivo excede o limite de 20 MB.'
    )
  })

  it('rejeita extensão inválida ou ausente', () => {
    expect(validateAttachmentFile(fileOf('a.exe', 1))).toContain(
      'Formato não suportado'
    )
    expect(validateAttachmentFile(fileOf('semextensao', 1))).toContain(
      'Formato não suportado'
    )
  })

  it('aceita todas as extensões permitidas, sem diferenciar maiúsculas', () => {
    for (const name of [
      'a.pdf',
      'a.txt',
      'a.md',
      'a.docx',
      'a.xlsx',
      'a.pptx',
      'a.png',
      'a.jpg',
      'a.JPEG',
    ]) {
      expect(validateAttachmentFile(fileOf(name, 1))).toBeUndefined()
    }
  })
})
