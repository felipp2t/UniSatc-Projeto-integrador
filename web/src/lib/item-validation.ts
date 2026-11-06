export const TITLE_MAX = 255

export const DESCRIPTION_MAX = 2000

export const TEXT_MAX = 100_000

export const SECRET_MAX = 8192

export const URL_MAX = 2048

export const FILE_MAX_MB = 20

export const FILE_MAX_BYTES = FILE_MAX_MB * 1_000_000

export const ATTACHMENT_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'docx',
  'xlsx',
  'pptx',
  'png',
  'jpg',
  'jpeg',
] as const

export const ATTACHMENT_REQUIRED_MESSAGE = 'Selecione um arquivo.'

const ATTACHMENT_FORMATS_LABEL = 'PDF, TXT, MD, DOCX, XLSX, PPTX, PNG ou JPEG'

export const ATTACHMENT_HINT = `${ATTACHMENT_FORMATS_LABEL} · até ${FILE_MAX_MB} MB`

export type TextualItemType = 'link' | 'secret' | 'text'

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)

    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    )
  } catch {
    return false
  }
}

export function isTitleInvalid(title: string) {
  const { length } = title.trim()

  return length < 1 || length > TITLE_MAX
}

export function isDescriptionInvalid(description: string) {
  return description.length > DESCRIPTION_MAX
}

// O segredo nunca é aparado ao enviar; só a validação usa trim.
export function isContentInvalid(type: TextualItemType, content: string) {
  const trimmed = content.trim()

  if (!trimmed) return true

  if (type === 'link') return trimmed.length > URL_MAX || !isHttpUrl(trimmed)

  return content.length > (type === 'text' ? TEXT_MAX : SECRET_MAX)
}

export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map(
  (extension) => `.${extension}`
).join(',')

export function validateAttachmentFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return `Formato não suportado. Use: ${ATTACHMENT_EXTENSIONS.join(', ')}.`
  }

  if (file.size > FILE_MAX_BYTES) {
    return `O arquivo excede o limite de ${FILE_MAX_MB} MB.`
  }
}
