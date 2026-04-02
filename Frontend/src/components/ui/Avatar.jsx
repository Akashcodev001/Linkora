import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/cn'

export function Avatar({ className, src, alt, fallback, size = 32 }) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-bg-muted',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? <AvatarPrimitive.Image className="h-full w-full object-cover" src={src} alt={alt || 'Avatar'} /> : null}
      <AvatarPrimitive.Fallback className="text-xs font-semibold uppercase text-text-secondary" delayMs={120}>
        {fallback || 'NA'}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export default Avatar
