import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div
      aria-live='polite'
      className='bg-destructive px-4 py-2 text-center text-destructive-foreground text-sm'
      role='status'
    >
      Você está offline. Algumas ações ficarão indisponíveis até a conexão
      voltar.
    </div>
  )
}
