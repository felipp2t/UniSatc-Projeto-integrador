import { describe, expect, it } from 'vitest'
import { itemKeys } from './item-keys'

describe('itemKeys', () => {
  it('list de arquivados tem chave própria, diferente da de ativos', () => {
    const active = itemKeys.list('ws', {
      archived: false,
      collectionId: 'c',
      page: 0,
    })
    const archived = itemKeys.list('ws', {
      archived: true,
      collectionId: 'c',
      page: 0,
    })
    expect(archived).not.toEqual(active)
    expect(archived).toContain('archived')
    expect(active).not.toContain('archived')
  })

  it('all é prefixo de list e detail', () => {
    const all = itemKeys.all('ws')
    expect(
      itemKeys
        .list('ws', { archived: false, collectionId: undefined, page: 1 })
        .slice(0, 2)
    ).toEqual(all)
    expect(itemKeys.detail('ws', 'i').slice(0, 2)).toEqual(all)
  })

  it('a chave do segredo não é invalidada junto com all', () => {
    expect(itemKeys.secret('ws', 'i').slice(0, 2)).not.toEqual(
      itemKeys.all('ws')
    )
  })

  it('attachment fica sob all e difere de detail', () => {
    const attachment = itemKeys.attachment('ws', 'i')
    expect(attachment.slice(0, 2)).toEqual(itemKeys.all('ws'))
    expect(attachment).not.toEqual(itemKeys.detail('ws', 'i'))
    expect(attachment).not.toEqual(itemKeys.attachment('ws', 'outro'))
  })
})
