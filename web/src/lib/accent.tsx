import { createContext, useContext, useEffect, useState } from 'react'

export const ACCENT_OPTIONS = [
  { color: '#00ff88', label: 'Verde', value: 'green' },
  { color: '#3b82f6', label: 'Azul', value: 'blue' },
  { color: '#a855f7', label: 'Roxo', value: 'purple' },
  { color: '#f97316', label: 'Laranja', value: 'orange' },
  { color: '#ef4444', label: 'Vermelho', value: 'red' },
  { color: '#ec4899', label: 'Rosa', value: 'pink' },
  { color: '#06b6d4', label: 'Ciano', value: 'cyan' },
] as const

export type Accent = (typeof ACCENT_OPTIONS)[number]['value']

const STORAGE_KEY = 'vaulty-accent'
const AccentContext = createContext<{
  accent: Accent
  setAccent: (accent: Accent) => void
} | null>(null)

function readAccent(): Accent {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return ACCENT_OPTIONS.some((option) => option.value === saved)
      ? (saved as Accent)
      : 'green'
  } catch {
    return 'green'
  }
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccent] = useState<Accent>(readAccent)

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    document.body.dataset.accent = accent
    try {
      localStorage.setItem(STORAGE_KEY, accent)
    } catch {
      // A preferência ainda se aplica à sessão atual se o armazenamento estiver indisponível.
    }
  }, [accent])

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>
      {children}
    </AccentContext.Provider>
  )
}

export function useAccent() {
  const context = useContext(AccentContext)
  if (!context) {
    throw new Error('useAccent deve ser usado dentro de AccentProvider.')
  }
  return context
}
