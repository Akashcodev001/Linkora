import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/cn'

export function Popover({ trigger, children, open, onOpenChange }) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={8}
          className={cn(
            'z-50 w-72 rounded-default border border-border/80 bg-bg-surface p-3 shadow-floating',
            'data-[state=open]:animate-[fadeIn_150ms_ease-out] data-[state=closed]:animate-[fadeOut_150ms_ease-in]',
          )}
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-bg-surface" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export default Popover
