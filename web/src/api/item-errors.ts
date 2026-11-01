import { toApiError } from './errors'
import { getApiErrorMessage } from './get-api-error-message'

const FORBIDDEN = 'Você não tem permissão para esta ação neste item.'
const UNAVAILABLE = 'Item indisponível. Atualize a lista e tente novamente.'
const NETWORK_UNCONFIRMED =
  'Não foi possível confirmar a alteração. Confira o item antes de tentar novamente.'
const REPLACE_FAILED =
  'A substituição não foi concluída; o arquivo anterior continua disponível.'
const REPLACE_UNCONFIRMED =
  'Não foi possível confirmar a substituição. Confira o arquivo do item antes de tentar novamente.'

const accessMessages = { 403: FORBIDDEN, 404: UNAVAILABLE }

export function getUpdateItemError(error: unknown, isSecret = false) {
  return getApiErrorMessage(error, {
    fallback: 'Não foi possível salvar o item.',
    network: NETWORK_UNCONFIRMED,
    statusMessages: {
      ...accessMessages,
      409: 'Título indisponível nesta localização',
    },
    // Mensagens do servidor nunca são exibidas para segredos.
    useServerMessage: !isSecret,
  })
}

export function getReplaceAttachmentError(error: unknown) {
  const { status } = toApiError(error)
  // Sem resposta (rede/abort) o resultado é desconhecido (RN21).
  if (status === undefined) return REPLACE_UNCONFIRMED
  if (status === 400) {
    const reason = getApiErrorMessage(error, {
      fallback: '',
      useServerMessage: true,
    })
    return reason ? `${REPLACE_FAILED} ${reason}` : REPLACE_FAILED
  }
  if (status === 403) return `${REPLACE_FAILED} ${FORBIDDEN}`
  if (status === 404) return `${REPLACE_FAILED} ${UNAVAILABLE}`
  return REPLACE_FAILED
}

export function getLoadItemError(error: unknown) {
  return getApiErrorMessage(error, {
    fallback: 'Não foi possível carregar o item.',
    statusMessages: accessMessages,
  })
}

function getStateChangeError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, {
    fallback,
    network: NETWORK_UNCONFIRMED,
    statusMessages: accessMessages,
    useServerMessage: true,
  })
}

export function getArchiveError(error: unknown) {
  return getStateChangeError(error, 'Não foi possível arquivar o item.')
}

export function getRestoreError(error: unknown) {
  return getStateChangeError(error, 'Não foi possível restaurar o item.')
}

export function getDeleteItemError(error: unknown) {
  return getStateChangeError(error, 'Não foi possível excluir o item.')
}
