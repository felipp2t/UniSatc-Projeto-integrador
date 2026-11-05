import { describe, expect, it } from 'vitest'
import { getNotificationHref } from './notification-navigation'

describe('notification destinations', () => {
  it.each([
    ['PROFILE_UPDATED', '/configuracoes/conta'],
    ['PASSWORD_CHANGED', '/configuracoes/conta'],
    ['ACCESS_CHANGED', '/'],
  ])('maps %s to a fixed internal destination', (event, expected) => {
    expect(
      getNotificationHref({ event, href: 'https://other.test/private' })
    ).toBe(expected)
  })
  it('ignores resource references and unknown events', () => {
    expect(
      getNotificationHref({
        event: 'UNKNOWN',
        href: '/secret',
        resourceId: 'secret',
      })
    ).toBeUndefined()
  })
})
