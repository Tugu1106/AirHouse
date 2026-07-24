export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-800/70 ${className}`} />;
}

/** Heading + toolbar + table rows — used by Inventory and Employees. */
export function ListSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Grid of cards — used by the Branches directory. */
export function CardsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Branch dashboard — header, tiles, panels. */
export function BranchSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
