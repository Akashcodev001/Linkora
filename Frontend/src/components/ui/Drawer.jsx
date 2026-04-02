import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

const widthClasses = {
  default: 'w-[380px]',
  wide: 'w-[480px]',
}

export function Drawer({ open, onOpenChange, title, children, width = 'default', trigger }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-[fadeIn_200ms_ease-out] data-[state=closed]:animate-[fadeOut_200ms_ease-in]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-screen border-l border-border bg-white p-5 shadow-modal',
            widthClasses[width],
            'data-[state=open]:animate-[drawerIn_200ms_ease-out] data-[state=closed]:animate-[drawerOut_200ms_ease-in]',
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <DialogPrimitive.Title className="text-base font-semibold text-text-primary">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button className="focus-ring rounded-sm p-1 text-text-muted hover:bg-bg-hover" aria-label="Close drawer">
                <X size={16} />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default Drawer
