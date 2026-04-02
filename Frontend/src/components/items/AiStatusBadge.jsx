import { AlertTriangle, LoaderCircle } from 'lucide-react'
import Badge from '@/components/ui/Badge'

export function AiStatusBadge({ status = 'pending', onRetry, retrying = false }) {
  if (status === 'processed') {
    return null
  }

  if (status === 'processed_without_ai') {
    return (
      <Badge variant="default" size="sm" showDot>
        Saved (AI unavailable)
      </Badge>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="error" size="sm" showDot>
          <AlertTriangle size={12} /> AI Failed
        </Badge>
        {onRetry ? (
          <button
            type="button"
            className="text-xs font-medium text-brand hover:underline"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        ) : null}
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <Badge variant="default" size="sm" showDot>
        <LoaderCircle size={12} className="animate-spin" /> Processing
      </Badge>
    )
  }

  return (
    <Badge variant="warning" size="sm" showDot>
      Queued
    </Badge>
  )
}

export default AiStatusBadge
