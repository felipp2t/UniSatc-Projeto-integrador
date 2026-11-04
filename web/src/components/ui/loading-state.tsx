export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div
      aria-busy='true'
      className='flex items-center justify-center p-8'
      role='status'
    >
      <span className='text-muted-foreground text-sm'>{label}</span>
    </div>
  )
}
