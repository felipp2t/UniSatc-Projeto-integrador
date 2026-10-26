import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundPage } from '@/components/not-found-page'

export const Route = createFileRoute('/_protected/$')({
  beforeLoad: () => {
    throw notFound()
  },
  notFoundComponent: NotFoundPage,
})
