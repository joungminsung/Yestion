export default function PageLoading() {
  return (
    <div className="mx-auto py-12 animate-pulse" style={{ maxWidth: "var(--page-max-width)", paddingLeft: "var(--page-padding-x)", paddingRight: "var(--page-padding-x)" }}>
      <div className="h-10 w-64 rounded mb-4" style={{ backgroundColor: "var(--bg-secondary)" }} />
      <div className="space-y-3">
        <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--bg-secondary)" }} />
        <div className="h-4 w-5/6 rounded" style={{ backgroundColor: "var(--bg-secondary)" }} />
        <div className="h-4 w-4/6 rounded" style={{ backgroundColor: "var(--bg-secondary)" }} />
        <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--bg-secondary)" }} />
        <div className="h-4 w-3/6 rounded" style={{ backgroundColor: "var(--bg-secondary)" }} />
      </div>
    </div>
  );
}
