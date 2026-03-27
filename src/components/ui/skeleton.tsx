import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded", className)}
      style={{ backgroundColor: "var(--bg-secondary)" }}
      {...props}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3 py-12" style={{ maxWidth: "var(--page-max-width)", margin: "0 auto", paddingLeft: "var(--page-padding-x)", paddingRight: "var(--page-padding-x)" }}>
      <Skeleton className="h-10 w-64 mb-6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <Skeleton className="h-20 w-full mt-4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/6" />
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-4 flex-1" style={{ width: `${60 + Math.random() * 40}%` }} />
        </div>
      ))}
    </div>
  );
}
