import { createFileRoute } from '@tanstack/react-router'
import { sanitizeInternalRedirect } from '@/auth/redirect'

export const Route = createFileRoute('/login')({
  component: LoginPlaceholder,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeInternalRedirect(search.redirect),
  }),
})

function LoginPlaceholder() {
  return (
    <main className='flex min-h-svh items-center justify-center px-6'>
      <h1 className='font-bold font-display text-3xl'>Login</h1>
    </main>
  )
}
