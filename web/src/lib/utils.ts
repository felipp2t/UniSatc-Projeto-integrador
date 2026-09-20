import { cn as cnImpl } from 'cn'

export function cn(...inputs: Parameters<typeof cnImpl>) {
  return cnImpl(...inputs)
}
