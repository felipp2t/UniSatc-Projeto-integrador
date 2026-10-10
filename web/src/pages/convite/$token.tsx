import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/convite/$token')({
  component: InvitePlaceholder,
})

function InvitePlaceholder() {
  return (
    <main className='flex min-h-svh items-center justify-center px-6'>
      <h1 className='font-bold font-display text-3xl'>Convite</h1>
    </main>
  )
}
