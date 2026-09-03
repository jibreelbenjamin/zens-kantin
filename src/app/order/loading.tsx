import { CardGridSkeleton } from "@/components/shared/skeletons";
export default function Loading() {
  return (
    <div className="min-h-screen bg-secondary/30 p-4 sm:p-6">
      <CardGridSkeleton count={9} />
    </div>
  );
}
