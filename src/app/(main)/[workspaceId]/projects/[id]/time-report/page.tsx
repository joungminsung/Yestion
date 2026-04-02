"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { Clock, BarChart3, Users, ListTodo } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type GroupBy = "task" | "day" | "user";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function TimeReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [groupBy, setGroupBy] = useState<GroupBy>("task");
  const [range, setRange] = useState(7); // days

  const from = useMemo(() => startOfDay(subDays(new Date(), range)), [range]);
  const to = useMemo(() => endOfDay(new Date()), []);

  const { data: report, isLoading } = trpc.timeEntry.report.useQuery({
    projectId,
    from,
    to,
    groupBy,
  });

  const totalSeconds = useMemo(() => {
    if (!report) return 0;
    return report.reduce((sum: number, r: Record<string, unknown>) => sum + ((r.totalSeconds as number) ?? 0), 0);
  }, [report]);

  const totalEntries = useMemo(() => {
    if (!report) return 0;
    return report.reduce((sum: number, r: Record<string, unknown>) => sum + ((r.count as number) ?? 0), 0);
  }, [report]);

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.map((r: Record<string, unknown>) => ({
      name: (r.title as string) ?? (r.date as string) ?? (r.userId as string) ?? "Unknown",
      hours: Math.round(((r.totalSeconds as number) / 3600) * 100) / 100,
    }));
  }, [report]);

  const groupByOptions: { id: GroupBy; label: string; icon: typeof ListTodo }[] = [
    { id: "task", label: "By Task", icon: ListTodo },
    { id: "day", label: "By Day", icon: BarChart3 },
    { id: "user", label: "By User", icon: Users },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Clock size={24} style={{ color: "var(--accent-blue)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Time Report
          </h1>
        </div>

        {/* Controls */}
        <div
          className="flex items-center gap-4 mb-6 pb-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
              Range:
            </span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className="px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: range === d ? "var(--bg-hover)" : "transparent",
                  color: range === d ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: range === d ? 500 : 400,
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="w-px h-5" style={{ backgroundColor: "var(--border-default)" }} />

          {/* Group by */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
              Group:
            </span>
            {groupByOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setGroupBy(opt.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: groupBy === opt.id ? "var(--bg-hover)" : "transparent",
                  color: groupBy === opt.id ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: groupBy === opt.id ? 500 : 400,
                }}
              >
                <opt.icon size={12} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Total Time
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatDuration(totalSeconds)}
            </div>
          </div>
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Entries
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {totalEntries}
            </div>
          </div>
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Daily Average
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatDuration(Math.round(totalSeconds / Math.max(1, range)))}
            </div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div
            className="p-4 rounded-lg border mb-6"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #eee)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-tertiary)" }}
                    label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--text-tertiary)" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}h`, "Time"]}
                  />
                  <Bar dataKey="hours" fill="var(--accent-blue, #2383e2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table */}
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div
            className="grid grid-cols-[1fr_100px_80px] gap-2 px-4 py-2 text-xs font-medium"
            style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-secondary)" }}
          >
            <span>{groupBy === "task" ? "Task" : groupBy === "day" ? "Date" : "User"}</span>
            <span>Time</span>
            <span>Entries</span>
          </div>
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              Loading...
            </div>
          ) : report?.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              No time entries in this period
            </div>
          ) : (
            report?.map((row: Record<string, unknown>, i: number) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_100px_80px] gap-2 px-4 py-2 border-t"
                style={{ borderColor: "var(--border-light, #eee)" }}
              >
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {(row.title as string) ?? (row.date ? format(new Date(row.date as string), "EEE, MMM d") : (row.userId as string))}
                </span>
                <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                  {formatDuration(row.totalSeconds as number)}
                </span>
                <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {row.count as number}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
