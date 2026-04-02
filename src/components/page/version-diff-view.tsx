"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { X, Loader2, GitCompare } from "lucide-react";

type DiffChange = {
  type: "insert" | "delete" | "equal";
  text: string;
};

export function VersionDiffView({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");

  const { data: snapshots, isLoading: loadingSnapshots } = trpc.history.list.useQuery({
    pageId,
    limit: 50,
  });

  const { data: diffData, isLoading: loadingDiff } = trpc.history.diff.useQuery(
    { snapshotIdA: selectedA!, snapshotIdB: selectedB! },
    { enabled: !!selectedA && !!selectedB },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="m-auto w-full max-w-4xl max-h-[80vh] rounded-xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border-divider)" }}
        >
          <div className="flex items-center gap-2">
            <GitCompare size={18} style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Version Diff
            </h2>
            {diffData?.stats && (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span style={{ color: "#00b450" }}>+{diffData.stats.additions}</span>
                {" / "}
                <span style={{ color: "#eb5757" }}>-{diffData.stats.deletions}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as "unified" | "split")}
              className="text-xs bg-transparent outline-none px-2 py-1 rounded border"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="unified">Unified</option>
              <option value="split">Split</option>
            </select>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-notion-bg-hover"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Snapshot selector */}
        <div
          className="flex items-center gap-4 px-5 py-3 border-b"
          style={{ borderColor: "var(--border-divider)" }}
        >
          <div className="flex-1">
            <label className="text-[10px] uppercase font-semibold mb-1 block" style={{ color: "var(--text-tertiary)" }}>
              From (older)
            </label>
            <select
              value={selectedA ?? ""}
              onChange={(e) => setSelectedA(e.target.value || null)}
              className="w-full text-xs bg-transparent outline-none px-2 py-1.5 rounded border"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">Select version...</option>
              {snapshots?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled"} — {new Date(s.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase font-semibold mb-1 block" style={{ color: "var(--text-tertiary)" }}>
              To (newer)
            </label>
            <select
              value={selectedB ?? ""}
              onChange={(e) => setSelectedB(e.target.value || null)}
              className="w-full text-xs bg-transparent outline-none px-2 py-1.5 rounded border"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">Select version...</option>
              {snapshots?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled"} — {new Date(s.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingDiff && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
            </div>
          )}

          {!selectedA || !selectedB ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-tertiary)" }}>
              Select two versions to compare
            </div>
          ) : diffData ? (
            viewMode === "unified" ? (
              <pre
                className="text-sm font-mono whitespace-pre-wrap leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {diffData.changes.map((change: DiffChange, i: number) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor:
                        change.type === "insert"
                          ? "rgba(0, 180, 80, 0.15)"
                          : change.type === "delete"
                            ? "rgba(235, 87, 87, 0.15)"
                            : "transparent",
                      textDecoration: change.type === "delete" ? "line-through" : "none",
                      color:
                        change.type === "insert"
                          ? "#00b450"
                          : change.type === "delete"
                            ? "#eb5757"
                            : "var(--text-primary)",
                    }}
                  >
                    {change.text}
                  </span>
                ))}
              </pre>
            ) : (
              <div className="flex gap-4">
                {/* Left: removed content */}
                <div className="flex-1">
                  <div className="text-[10px] uppercase font-semibold mb-2" style={{ color: "var(--text-tertiary)" }}>
                    Before
                  </div>
                  <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {diffData.changes
                      .filter((c: DiffChange) => c.type !== "insert")
                      .map((change: DiffChange, i: number) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor:
                              change.type === "delete" ? "rgba(235, 87, 87, 0.15)" : "transparent",
                            textDecoration: change.type === "delete" ? "line-through" : "none",
                            color: change.type === "delete" ? "#eb5757" : "var(--text-primary)",
                          }}
                        >
                          {change.text}
                        </span>
                      ))}
                  </pre>
                </div>
                {/* Right: added content */}
                <div className="flex-1">
                  <div className="text-[10px] uppercase font-semibold mb-2" style={{ color: "var(--text-tertiary)" }}>
                    After
                  </div>
                  <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {diffData.changes
                      .filter((c: DiffChange) => c.type !== "delete")
                      .map((change: DiffChange, i: number) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor:
                              change.type === "insert" ? "rgba(0, 180, 80, 0.15)" : "transparent",
                            color: change.type === "insert" ? "#00b450" : "var(--text-primary)",
                          }}
                        >
                          {change.text}
                        </span>
                      ))}
                  </pre>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
