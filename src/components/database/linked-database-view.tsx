"use client";

import { trpc } from "@/server/trpc/client";
import { Link as LinkIcon, ExternalLink, Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

type LinkedDatabaseViewProps = {
  databaseId: string;
  viewId?: string | null;
};

export function LinkedDatabaseView({ databaseId }: LinkedDatabaseViewProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { data: database, isLoading } = trpc.database.get.useQuery(
    { databaseId },
    { enabled: !!databaseId },
  );

  const { data: rows } = trpc.database.queryRows.useQuery(
    { databaseId },
    { enabled: !!databaseId },
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8 rounded-lg border my-2"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  if (!database) {
    return (
      <div
        className="flex items-center gap-2 py-4 px-4 rounded-lg border my-2 text-sm"
        style={{
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-tertiary)",
        }}
      >
        <LinkIcon size={14} />
        Database not found or deleted
      </div>
    );
  }

  const visibleProperties = database.properties.filter((p) => p.isVisible).slice(0, 5);

  return (
    <div
      className="my-2 rounded-lg border overflow-hidden"
      style={{
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{
          borderColor: "var(--border-divider)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-2">
          <LinkIcon size={14} style={{ color: "#2383e2" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {database.page.title || "Untitled Database"}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "rgba(35, 131, 226, 0.1)",
              color: "#2383e2",
            }}
          >
            Linked
          </span>
        </div>
        <button
          onClick={() => router.push(`/${workspaceId}/${database.page.id}`)}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}
          title="Open original database"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Simple table preview */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderBottom: "1px solid var(--border-divider)",
              }}
            >
              {visibleProperties.map((prop) => (
                <th
                  key={prop.id}
                  className="px-3 py-1.5 text-left text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {prop.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.slice(0, 10).map((row) => {
              const values = (row.values as Record<string, unknown>) ?? {};
              return (
                <tr
                  key={row.id}
                  className="hover:bg-notion-bg-hover cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border-divider)" }}
                  onClick={() => router.push(`/${workspaceId}/${row.page.id}`)}
                >
                  {visibleProperties.map((prop) => (
                    <td
                      key={prop.id}
                      className="px-3 py-2 text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {prop.type === "title"
                        ? row.page.title || "Untitled"
                        : values[prop.id] !== undefined
                          ? String(values[prop.id])
                          : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows && rows.length > 10 && (
        <div
          className="text-center py-2 text-xs border-t"
          style={{
            borderColor: "var(--border-divider)",
            color: "var(--text-tertiary)",
          }}
        >
          +{rows.length - 10} more rows
        </div>
      )}
    </div>
  );
}
