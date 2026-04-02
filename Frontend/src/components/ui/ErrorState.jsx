import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export function ErrorState({ message, onRetry, title = 'Something went wrong', className }) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center rounded-default border border-red-200 bg-red-50/60 p-8 text-center', className)}>
      <AlertTriangle size={44} className="mb-4 text-red-500" strokeWidth={1.5} />
      <h3 className="text-base font-semibold text-red-700">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-red-600">{message || 'Please try again in a moment.'}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5 border-red-300 text-red-700 hover:bg-red-100" onClick={onRetry}>
          Try Again
        </Button>
      ) : null}
    </div>
  )
}

export default ErrorState
