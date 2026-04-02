import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/cn'

export function DropdownMenu({ trigger, children }) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          sideOffset={8}
          className={cn(
            'z-50 min-w-[180px] rounded-default border border-border/80 bg-bg-surface p-1 shadow-floating',
            'data-[state=open]:animate-[fadeIn_150ms_ease-out] data-[state=closed]:animate-[fadeOut_150ms_ease-in]',
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

export function DropdownMenuItem({ className, inset = false, ...props }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'focus-ring relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm text-text-secondary outline-none transition-colors hover:bg-bg-hover focus:bg-bg-hover',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({ className, ...props }) {
  return <DropdownMenuPrimitive.Separator className={cn('my-1 h-px bg-border', className)} {...props} />
}

export default DropdownMenu
