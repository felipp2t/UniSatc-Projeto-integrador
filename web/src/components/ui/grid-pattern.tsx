import { cn } from 'cn'
import * as React from 'react'

interface GridPatternProps extends React.SVGProps<SVGSVGElement> {
  height?: number
  squares?: [number, number][]
  strokeDasharray?: string
  width?: number
  x?: number
  y?: number
}

export function GridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  squares,
  strokeDasharray = '0',
  className,
  ...props
}: GridPatternProps) {
  const id = React.useId()
  return (
    <svg
      aria-hidden='true'
      className={cn(
        'pointer-events-none absolute inset-0 size-full fill-foreground/15 stroke-foreground/15',
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          height={height}
          id={id}
          patternUnits='userSpaceOnUse'
          width={width}
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill='none'
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height='100%' width='100%' />
      {squares?.map(([squareX, squareY], index) => (
        <rect
          height={height - 1}
          key={`${squareX}-${squareY}-${index}`}
          width={width - 1}
          x={squareX * width + 1}
          y={squareY * height + 1}
        />
      ))}
    </svg>
  )
}

export type { GridPatternProps }
