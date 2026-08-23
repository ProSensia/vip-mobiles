import { CatalogGridSkeleton } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function CatalogLoading() {
  return (
    <div className="container-page py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
      <div className="mt-8">
        <CatalogGridSkeleton count={12} />
      </div>
    </div>
  );
}
