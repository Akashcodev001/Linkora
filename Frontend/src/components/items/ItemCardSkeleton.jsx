import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'

export function ItemCardSkeleton() {
  return (
    <Card className="overflow-hidden" padding="default">
      <Skeleton className="aspect-video w-full" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
        <div className="pt-2">
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </Card>
  )
}

export default ItemCardSkeleton
