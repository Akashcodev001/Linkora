import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/cn'

export function Separator({ className, orientation = 'horizontal', decorative = true }) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  )
}

export default Separator
