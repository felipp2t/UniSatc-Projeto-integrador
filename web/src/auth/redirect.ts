export function sanitizeInternalRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return undefined
  }

  try {
    const origin =
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin
    const url = new URL(value, origin)
    if (url.origin !== origin) {
      return undefined
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}
