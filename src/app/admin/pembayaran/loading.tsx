import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Card><CardContent className="space-y-3 p-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </CardContent></Card>
    </div>
  );
}
