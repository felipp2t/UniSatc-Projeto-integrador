export function UploadProgress({
  children,
  label,
  progress,
}: {
  children?: React.ReactNode
  label?: string
  progress: number
}) {
  return (
    <div aria-live='polite' className='space-y-2 text-xs'>
      <progress
        aria-label='Progresso do envio'
        className='w-full'
        max={100}
        value={progress}
      />
      <p>{label ?? `Envio: ${progress}%`}</p>
      {children}
    </div>
  )
}
