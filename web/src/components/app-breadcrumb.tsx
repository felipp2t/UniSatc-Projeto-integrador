import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbEllipsisTrigger,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AppRoute } from '@/types/navigation'

export interface AppBreadcrumbItem {
  label: string
  to?: AppRoute
}

interface AppBreadcrumbProps {
  items: readonly AppBreadcrumbItem[]
  maxVisibleItems?: number
}

export function AppBreadcrumb({ items, maxVisibleItems }: AppBreadcrumbProps) {
  const visibleLimit = Math.max(maxVisibleItems ?? items.length, 3)
  const shouldCollapse = items.length > visibleLimit
  const middleItems = items.slice(1, -1)
  const visibleMiddleCount = visibleLimit - 2
  const hiddenItems = shouldCollapse
    ? middleItems.slice(0, -visibleMiddleCount)
    : []
  const visibleMiddleItems = shouldCollapse
    ? middleItems.slice(-visibleMiddleCount)
    : middleItems
  const visibleItems =
    items.length === 1
      ? [items[0]]
      : [
          items[0],
          ...(hiddenItems.length > 0 ? [null] : []),
          ...visibleMiddleItems,
          items.at(-1),
        ].filter((item): item is AppBreadcrumbItem | null => item !== undefined)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visibleItems.map((item, index) => {
          if (item === null) {
            return (
              <Fragment key='ellipsis'>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <BreadcrumbEllipsisTrigger />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start'>
                      {hiddenItems.map((hiddenItem) => (
                        <BreadcrumbMenuItem
                          item={hiddenItem}
                          key={hiddenItem.label}
                        />
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
              </Fragment>
            )
          }

          const isCurrent = index === visibleItems.length - 1
          return (
            <BreadcrumbRouteItem
              isCurrent={isCurrent}
              isFirst={index === 0}
              item={item}
              key={`${item.label}-${item.to ?? 'current'}`}
            />
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function BreadcrumbRouteItem({
  isFirst,
  isCurrent,
  item,
}: {
  isFirst: boolean
  isCurrent: boolean
  item: AppBreadcrumbItem
}) {
  return (
    <>
      {isFirst ? null : <BreadcrumbSeparator />}
      <BreadcrumbItem>
        {isCurrent || !item.to ? (
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link to={item.to}>{item.label}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
    </>
  )
}

function BreadcrumbMenuItem({ item }: { item: AppBreadcrumbItem }) {
  if (!item.to) {
    return <DropdownMenuItem disabled>{item.label}</DropdownMenuItem>
  }

  return (
    <DropdownMenuItem asChild>
      <Link to={item.to}>{item.label}</Link>
    </DropdownMenuItem>
  )
}

export type { AppBreadcrumbProps }
