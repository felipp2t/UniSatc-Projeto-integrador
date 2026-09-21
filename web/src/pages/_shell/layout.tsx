import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/header'
import { GridPattern } from '@/components/ui/grid-pattern'
import { ScrollArea } from '@/components/ui/scroll-area'

export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
})

function ShellLayout() {
  return (
    <div className='relative h-svh'>
      <GridPattern />
      <div className='relative z-10 flex h-full flex-col bg-background/80'>
        <Header />
        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <ScrollArea className='flex-1'>
            <Outlet />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
