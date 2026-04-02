import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

const sizeClasses = {
  sm: 'max-w-[480px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[720px]',
}

export function Dialog({ open, onOpenChange, title, description, size = 'md', children, footer, trigger }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fadeIn_200ms_ease-out] data-[state=closed]:animate-[fadeOut_200ms_ease-in]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/80 bg-bg-surface p-5 shadow-modal',
            'data-[state=open]:animate-[dialogIn_300ms_ease-out] data-[state=closed]:animate-[dialogOut_200ms_ease-in]',
            sizeClasses[size],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {title ? <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">{title}</DialogPrimitive.Title> : null}
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <button className="focus-ring rounded-sm p-1 text-text-muted hover:bg-bg-hover" aria-label="Close dialog">
                <X size={16} />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div>{children}</div>
          {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default Dialog
