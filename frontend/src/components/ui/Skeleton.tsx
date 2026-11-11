import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  readonly className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-line', className)} />;
}

interface TableSkeletonProps {
  readonly rowCount?: number;
  readonly columnCount?: number;
}

/** Mirrors the shape of DataTable while data loads. */
export function TableSkeleton({ rowCount = 6, columnCount = 4 }: TableSkeletonProps) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: columnCount }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}
