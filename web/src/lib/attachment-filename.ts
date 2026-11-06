const extendedFilenamePattern =
  /(?:^|;)\s*filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i

const plainFilenamePattern = /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]+))/i

function decodeFilename(encodedName: string) {
  try {
    return decodeURIComponent(encodedName.trim())
  } catch {
    return ''
  }
}

export function attachmentFilename(
  rawDisposition: unknown,
  fallback: string
): string {
  const disposition =
    typeof rawDisposition === 'string' ? rawDisposition : undefined

  const encodedName = disposition?.match(extendedFilenamePattern)?.[1]

  const plainName = disposition?.match(plainFilenamePattern)

  return (
    (encodedName ? decodeFilename(encodedName) : undefined) ||
    plainName?.[1]?.trim() ||
    plainName?.[2]?.trim() ||
    fallback
  )
}
