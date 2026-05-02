import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  title?: boolean;
}

export function TableSkeleton({ rows = 5, columns = 4, title = true }: TableSkeletonProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {/* Table header */}
          <div className="flex gap-4 pb-3 border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>

          {/* Table rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 py-3">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className={`h-4 flex-1 ${colIndex === 0 ? 'w-1/4' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RosterTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-56" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {['Rank', 'Name', 'Email', 'Amount', 'Goal', 'Donations', 'Status', 'Actions'].map((_, i) => (
                  <th key={i} className="text-left py-3 px-4">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="py-4 px-4"><Skeleton className="h-4 w-8" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-40" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                  <td className="py-4 px-4"><Skeleton className="h-9 w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
