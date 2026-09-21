import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { appToast } from '@/components/ui/toast'

export const Route = createFileRoute('/_shell/components')({
  component: ComponentsPage,
  head: () => ({ meta: [{ title: 'Components · web' }] }),
})

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className='flex flex-col gap-5'>
      <div>
        <h2 className='font-display font-semibold text-lg'>{title}</h2>
        <p className='mt-1 text-muted-foreground text-sm'>{description}</p>
      </div>
      {children}
    </section>
  )
}

function ComponentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const closeDialog = useCallback(() => setDialogOpen(false), [])
  const showToast = useCallback(() => {
    appToast.success('Saved successfully', {
      description: 'Your changes are up to date.',
      duration: 5000,
    })
  }, [])

  return (
    <main className='mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-12 px-6 py-12'>
      <AppBreadcrumb
        items={[{ label: 'Início', to: '/' }, { label: 'Componentes' }]}
      />
      <header className='flex flex-col gap-3 border-border border-b pb-8'>
        <p className='font-mono text-primary text-xs uppercase tracking-[0.2em]'>
          Rootly · UI inventory
        </p>
        <h1 className='font-bold font-display text-4xl tracking-tight'>
          Components
        </h1>
        <p className='max-w-2xl text-muted-foreground'>
          Catálogo visual dos componentes disponíveis, suas variações e estados
          principais.
        </p>
      </header>

      <Section
        description='Ações principais, secundárias e utilitárias.'
        title='Button'
      >
        <div className='flex flex-wrap items-center gap-3'>
          <Button>Default</Button>
          <Button variant='destructive'>Destructive</Button>
          <Button variant='outline'>Outline</Button>
          <Button variant='secondary'>Secondary</Button>
          <Button variant='ghost'>Ghost</Button>
          <Button variant='link'>Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button size='sm'>Small</Button>
          <Button>Default</Button>
          <Button size='lg'>Large</Button>
          <Button aria-label='Menu' size='icon'>
            +
          </Button>
        </div>
      </Section>

      <Section
        description='Estados, seleção, navegação e feedback.'
        title='Remaining components'
      >
        <div className='flex flex-wrap items-center gap-2'>
          <Badge>Default</Badge>
          <Badge variant='secondary'>Secondary</Badge>
          <Badge variant='outline'>Outline</Badge>
          <Badge variant='destructive'>Destructive</Badge>
        </div>
        <div className='flex max-w-lg flex-wrap items-center gap-6'>
          <FieldLabel
            className='flex items-center gap-2 text-sm'
            htmlFor='component-terms'
          >
            <Checkbox id='component-terms' />
            Accept terms
          </FieldLabel>
          <Select defaultValue='option-one'>
            <SelectTrigger className='w-48'>
              <SelectValue placeholder='Select option' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='option-one'>Option one</SelectItem>
              <SelectItem value='option-two'>Option two</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Tabs className='max-w-lg' defaultValue='overview'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>
          <TabsContent value='overview'>
            <p className='text-muted-foreground text-sm'>Overview content.</p>
          </TabsContent>
          <TabsContent value='activity'>
            <p className='text-muted-foreground text-sm'>Activity content.</p>
          </TabsContent>
        </Tabs>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Workspace</TableCell>
              <TableCell>
                <Badge variant='secondary'>Active</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState
          action={<Button size='sm'>Create workspace</Button>}
          description='Create your first workspace to get started.'
          title='Nothing here yet'
        />
        <div className='flex flex-wrap items-center gap-3'>
          <Button onClick={showToast} variant='outline'>
            Show toast
          </Button>
        </div>
      </Section>

      <Section
        description='Campos de texto e composição com Field.'
        title='Input & Field'
      >
        <div className='grid max-w-2xl gap-5 md:grid-cols-2'>
          <Field>
            <FieldLabel htmlFor='component-email'>Email</FieldLabel>
            <FieldContent>
              <Input
                id='component-email'
                placeholder='you@example.com'
                type='email'
              />
              <FieldDescription>
                Seu endereço de email principal.
              </FieldDescription>
            </FieldContent>
          </Field>
          <Field>
            <Label htmlFor='component-password'>Password</Label>
            <Input
              id='component-password'
              placeholder='••••••••'
              type='password'
            />
            <FieldError>Senha inválida.</FieldError>
          </Field>
        </div>
      </Section>

      <Section
        description='Conteúdo agrupado em uma superfície visual.'
        title='Card'
      >
        <Card className='max-w-lg'>
          <CardHeader>
            <CardTitle>Workspace settings</CardTitle>
            <CardDescription>
              Configure as preferências do seu workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground text-sm'>
              Conteúdo principal do card.
            </p>
          </CardContent>
          <CardFooter>
            <Button size='sm'>Save changes</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section
        description='Separadores de conteúdo e carregamento progressivo.'
        title='Separator & Skeleton'
      >
        <div className='flex max-w-lg flex-col gap-4'>
          <Skeleton className='h-4 w-3/4' />
          <Separator />
          <Skeleton className='h-4 w-1/2' />
          <Separator className='h-8' orientation='vertical' />
        </div>
      </Section>

      <Section
        description='Menus, modais e áreas com rolagem.'
        title='Dialog, Dropdown & ScrollArea'
      >
        <div className='flex flex-wrap items-center gap-3'>
          <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm action</DialogTitle>
                <DialogDescription>
                  Esta é uma prévia do componente Dialog.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={closeDialog}>Continue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline'>Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ScrollArea className='h-24 max-w-lg border border-border p-3'>
          <div className='flex flex-col gap-3 text-muted-foreground text-sm'>
            {[
              'First item',
              'Second item',
              'Third item',
              'Fourth item',
              'Fifth item',
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </ScrollArea>
      </Section>
    </main>
  )
}
