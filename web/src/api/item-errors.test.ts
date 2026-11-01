import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import {
  getArchiveError,
  getDeleteItemError,
  getLoadItemError,
  getReplaceAttachmentError,
  getRestoreError,
  getUpdateItemError,
} from './item-errors'

const network = () =>
  new ApiError('x', undefined, undefined, undefined, { networkError: true })
const REPLACE =
  'A substituição não foi concluída; o arquivo anterior continua disponível.'
const REPLACE_UNKNOWN =
  'Não foi possível confirmar a substituição. Confira o arquivo do item antes de tentar novamente.'
const UNCONFIRMED =
  'Não foi possível confirmar a alteração. Confira o item antes de tentar novamente.'

describe('getUpdateItemError', () => {
  it('mapeia 409 para título indisponível', () => {
    expect(getUpdateItemError(new ApiError('detalhe', 409))).toBe(
      'Título indisponível nesta localização'
    )
  })

  it('mapeia 403 e 404', () => {
    expect(getUpdateItemError(new ApiError('x', 403))).toContain('permissão')
    expect(getUpdateItemError(new ApiError('x', 404))).toContain('indisponível')
  })

  it('erro de rede não afirma que a alteração falhou (RN21)', () => {
    expect(getUpdateItemError(network())).toBe(UNCONFIRMED)
  })

  it('usa a mensagem do servidor para itens comuns', () => {
    expect(getUpdateItemError(new ApiError('Detalhe', 422))).toBe('Detalhe')
  })

  it('nunca expõe a mensagem do servidor para segredos', () => {
    const message = getUpdateItemError(new ApiError('valor-secreto', 422), true)
    expect(message).toBe('Não foi possível salvar o item.')
    expect(message).not.toContain('valor-secreto')
  })
})

describe('getReplaceAttachmentError', () => {
  it('400 acrescenta o motivo do servidor', () => {
    expect(
      getReplaceAttachmentError(new ApiError('Formato inválido', 400))
    ).toBe(`${REPLACE} Formato inválido`)
  })

  it('400 sem motivo mantém só o aviso', () => {
    expect(getReplaceAttachmentError(new ApiError('', 400))).toBe(REPLACE)
  })

  it('503 e 413 (falha confirmada) mantêm o aviso de arquivo anterior', () => {
    expect(getReplaceAttachmentError(new ApiError('x', 503))).toBe(REPLACE)
    expect(getReplaceAttachmentError(new ApiError('x', 413))).toBe(REPLACE)
  })

  it('rede e abort têm resultado desconhecido, sem afirmar falha (RN21)', () => {
    const canceled = new ApiError('x', undefined, undefined, undefined, {
      canceled: true,
    })
    expect(getReplaceAttachmentError(network())).toBe(REPLACE_UNKNOWN)
    expect(getReplaceAttachmentError(canceled)).toBe(REPLACE_UNKNOWN)
  })

  it('403 e 404 acrescentam o motivo de acesso', () => {
    expect(getReplaceAttachmentError(new ApiError('x', 403))).toContain(
      'permissão'
    )
    expect(getReplaceAttachmentError(new ApiError('x', 404))).toContain(
      'indisponível'
    )
  })
})

describe('getLoadItemError', () => {
  it('usa mensagem de leitura, não a de edição', () => {
    expect(getLoadItemError(new ApiError('', 500))).toBe(
      'Não foi possível carregar o item.'
    )
    expect(getLoadItemError(new ApiError('x', 404))).toContain('indisponível')
  })
})

describe('erros de arquivar, restaurar e excluir', () => {
  it('409 usa a mensagem do servidor', () => {
    expect(getArchiveError(new ApiError('Item já arquivado', 409))).toBe(
      'Item já arquivado'
    )
    expect(getRestoreError(new ApiError('Item não está arquivado', 409))).toBe(
      'Item não está arquivado'
    )
    expect(
      getDeleteItemError(
        new ApiError('Somente itens arquivados podem ser excluídos', 409)
      )
    ).toBe('Somente itens arquivados podem ser excluídos')
  })

  it('rede mostra a mensagem de confirmação (RN21)', () => {
    expect(getArchiveError(network())).toBe(UNCONFIRMED)
    expect(getRestoreError(network())).toBe(UNCONFIRMED)
    expect(getDeleteItemError(network())).toBe(UNCONFIRMED)
  })

  it('403 e 404 usam mensagens de acesso', () => {
    expect(getArchiveError(new ApiError('x', 403))).toContain('permissão')
    expect(getDeleteItemError(new ApiError('x', 404))).toContain('indisponível')
  })

  it('usa fallback quando não há mensagem', () => {
    expect(getArchiveError(new ApiError('', 500))).toBe(
      'Não foi possível arquivar o item.'
    )
    expect(getRestoreError(new ApiError('', 500))).toBe(
      'Não foi possível restaurar o item.'
    )
    expect(getDeleteItemError(new ApiError('', 500))).toBe(
      'Não foi possível excluir o item.'
    )
  })
})
