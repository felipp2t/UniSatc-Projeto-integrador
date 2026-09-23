import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/esqueci-senha')({
  component: ForgotPasswordPlaceholder,
})

function ForgotPasswordPlaceholder() {
  return (
    <main className='flex min-h-svh items-center justify-center px-6'>
      <h1 className='font-bold font-display text-3xl'>Recuperação de senha</h1>
    </main>
  )
}
