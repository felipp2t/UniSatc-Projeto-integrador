export function OfflineState() {
  return (
    <div
      aria-live='polite'
      className='flex flex-col items-center gap-2 p-8 text-center'
      role='alert'
    >
      <h3 className='font-semibold'>Você está offline</h3>
      <p className='text-muted-foreground text-sm'>
        Aguardando conexão para carregar os dados.
      </p>
    </div>
  )
}
