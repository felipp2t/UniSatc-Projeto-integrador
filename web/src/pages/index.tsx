import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
  head: () => ({
    meta: [{ title: 'web' }],
  }),
})

function HomePage() {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  )
}
