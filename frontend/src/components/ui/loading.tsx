import { Skeleton } from './skeleton'

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <Skeleton className="h-8 w-48" />
         <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
         ))}
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 6, height = "h-48" }: { count?: number, height?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
       {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={`${height} rounded-lg`} />
       ))}
    </div>
  )
}
