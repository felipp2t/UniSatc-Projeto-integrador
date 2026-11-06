import { createContext, useContext, useEffect, useState } from 'react'

export const ACCENT_OPTIONS = [
  { value: 'green', label: 'Verde', color: '#00ff88' },
  { value: 'blue', label: 'Azul', color: '#3b82f6' },
  { value: 'purple', label: 'Roxo', color: '#a855f7' },
  { value: 'orange', label: 'Laranja', color: '#f97316' },
  { value: 'red', label: 'Vermelho', color: '#ef4444' },
  { value: 'pink', label: 'Rosa', color: '#ec4899' },
  { value: 'cyan', label: 'Ciano', color: '#06b6d4' },
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
