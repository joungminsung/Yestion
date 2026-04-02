"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, Search } from "lucide-react";

export default function AuditLogPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  const { data, fetchNextPage, hasNextPage, isLoading } = trpc.activity.workspaceList.useInfiniteQuery(
    { workspaceId, search: search || undefined, action: actionFilter || undefined, from: dateRange.from, to: dateRange.to, limit: 50 },
    { getNextPageParam: (last) => last.nextCursor },
  );

  const { data: chartData } = trpc.activity.dailyCounts.useQuery({ workspaceId, days: 30 });

  const allItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const exportCsv = () => {
    const header = "Date,User,Action,Page,Metadata\n";
    const rows = allItems.map((item) =>
      `${item.createdAt},${item.user.name ?? "Unknown"},${item.action},${item.page?.title ?? ""},${JSON.stringify(item.metadata)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${workspaceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>감사 로그</h1>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
          <Download size={16} /> CSV 내보내기
        </button>
      </div>

      {/* Activity Chart */}
      {chartData && chartData.length > 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>일별 활동</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#2383e2" fill="#2383e2" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="활동 검색..."
            className="w-full pl-9 pr-3 py-2 rounded-md text-sm border"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-md text-sm border"
          style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          <option value="">모든 활동</option>
          <option value="page.created">페이지 생성</option>
          <option value="page.updated">페이지 수정</option>
          <option value="page.deleted">페이지 삭제</option>
          <option value="member.invited">멤버 초대</option>
          <option value="member.removed">멤버 제거</option>
          <option value="permission.changed">권한 변경</option>
        </select>
        <input
          type="date"
          onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
          className="px-3 py-2 rounded-md text-sm border"
          style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        />
        <input
          type="date"
          onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
          className="px-3 py-2 rounded-md text-sm border"
          style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Log Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>시간</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>사용자</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>활동</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>페이지</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((item) => (
              <tr key={item.id} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                  {new Date(item.createdAt).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{item.user.name ?? "Unknown"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                    {item.action}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{item.page?.title ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasNextPage && (
          <div className="p-4 text-center">
            <button onClick={() => fetchNextPage()} className="text-sm px-4 py-2 rounded" style={{ color: "#2383e2" }}>
              더 보기
            </button>
          </div>
        )}
        {isLoading && <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>로딩 중...</div>}
      </div>
    </div>
  );
}
