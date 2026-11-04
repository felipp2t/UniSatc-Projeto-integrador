import { useSyncExternalStore } from 'react'

// O administrador geral escolhe qual workspace está navegando; os demais usuários têm um só.
const STORAGE_KEY = 'vaulty:admin-workspace'
const listeners = new Set<() => void>()
let selectedWorkspaceId = readStoredSelection()

function readStoredSelection() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    // Sem sessionStorage (janela privada ou bloqueio), nenhum workspace fica selecionado.
  }
}

export function selectAdminWorkspace(workspaceId: string | undefined) {
  selectedWorkspaceId = workspaceId
  try {
    if (workspaceId) sessionStorage.setItem(STORAGE_KEY, workspaceId)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sem sessionStorage, a escolha vale apenas até recarregar a página.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return selectedWorkspaceId
}

export function useAdminWorkspaceSelection() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
