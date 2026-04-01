import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded", className)}
      style={{ backgroundColor: "var(--bg-tertiary, #e8e7e4)" }}
      {...props}
    />
  );
}

export function PageSkeleton() {
  return (
    <div
      className="space-y-3 py-12"
      style={{
        maxWidth: "var(--page-max-width)",
        margin: "0 auto",
        paddingLeft: "var(--page-padding-x)",
        paddingRight: "var(--page-padding-x)",
      }}
    >
      {/* Title */}
      <Skeleton className="h-10 w-64 mb-6" />
      {/* Content lines */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
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
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${60 + (i * 7) % 40}%` }} />
        </div>
      ))}
    </div>
  );
}

export function DatabaseSkeleton() {
  return (
    <div
      className="py-8"
      style={{
        maxWidth: "var(--page-max-width)",
        margin: "0 auto",
        paddingLeft: "var(--page-padding-x)",
        paddingRight: "var(--page-padding-x)",
      }}
    >
      {/* Title */}
      <Skeleton className="h-8 w-48 mb-6" />

      {/* Toolbar row */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-7 w-20 rounded" />
        <Skeleton className="h-7 w-20 rounded" />
        <Skeleton className="h-7 w-16 rounded" />
      </div>

      {/* Table header */}
      <div
        className="flex items-center gap-0 mb-1"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <Skeleton className="h-8 flex-1" style={{ borderRadius: 0 }} />
        <Skeleton className="h-8 w-32 ml-px" style={{ borderRadius: 0 }} />
        <Skeleton className="h-8 w-28 ml-px" style={{ borderRadius: 0 }} />
        <Skeleton className="h-8 w-24 ml-px" style={{ borderRadius: 0 }} />
      </div>

      {/* Table rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-0 py-0.5"
          style={{ borderBottom: "1px solid var(--border-divider, var(--border-default))" }}
        >
          <div className="flex-1 px-2 py-2">
            <Skeleton className="h-4" style={{ maxWidth: `${50 + (i * 13) % 40}%` }} />
          </div>
          <div className="w-32 px-2 py-2 ml-px">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="w-28 px-2 py-2 ml-px">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="w-24 px-2 py-2 ml-px">
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
