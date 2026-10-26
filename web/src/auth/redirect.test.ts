import { describe, expect, it } from 'vitest'
import { sanitizeInternalRedirect } from './redirect'

describe('internal redirects', () => {
  it('keeps pathname, search and hash for internal paths', () => {
    expect(sanitizeInternalRedirect('/componentes?tab=overview#details')).toBe(
      '/componentes?tab=overview#details'
    )
  })

  it('rejects external and ambiguous paths', () => {
    expect(sanitizeInternalRedirect('https://example.com')).toBeUndefined()
    expect(sanitizeInternalRedirect('//example.com')).toBeUndefined()
    expect(sanitizeInternalRedirect('/\\example.com')).toBeUndefined()
    expect(sanitizeInternalRedirect('componentes')).toBeUndefined()
  })

  it('rejects non-string values and uses no redirect as fallback', () => {
    expect(sanitizeInternalRedirect(undefined)).toBeUndefined()
    expect(sanitizeInternalRedirect({})).toBeUndefined()
  })
})
