"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { Users, FileText, Shield } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="rounded-lg p-4 border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)" }}>{icon}</div>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
      {subtext && <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{subtext}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [roleFilter, setRoleFilter] = useState("");

  const { data: members, refetch, isLoading } = trpc.workspace.members.useQuery({ workspaceId });
  const { data: wsData } = trpc.workspace.get.useQuery({ id: workspaceId });
  const { data: customRoles } = trpc.role.list.useQuery({ workspaceId });
  const updateRole = trpc.workspace.updateMemberRole.useMutation({ onSuccess: () => refetch() });
  const removeMember = trpc.workspace.removeMember.useMutation({ onSuccess: () => refetch() });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />)}
          </div>
        </div>
      </div>
    );
  }

  const filteredMembers = members?.filter((m: { role: string; customRole?: { id: string; name: string } | null }) => {
    if (!roleFilter) return true;
    if (m.role === roleFilter) return true;
    return m.customRole?.id === roleFilter;
  }) ?? [];

  const stats = {
    totalMembers: members?.length ?? 0,
    admins: members?.filter((m: { role: string }) => m.role === "ADMIN" || m.role === "OWNER").length ?? 0,
    guests: members?.filter((m: { role: string }) => m.role === "GUEST").length ?? 0,
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>관리자 대시보드</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={18} style={{ color: "#2383e2" }} />} label="전체 멤버" value={stats.totalMembers} />
        <StatCard icon={<Shield size={18} style={{ color: "#e28323" }} />} label="관리자" value={stats.admins} />
        <StatCard icon={<Users size={18} style={{ color: "#9b59b6" }} />} label="게스트" value={stats.guests} />
        <StatCard icon={<FileText size={18} style={{ color: "#27ae60" }} />} label="워크스페이스" value={wsData?.name ?? "-"} subtext="현재 워크스페이스" />
      </div>

      {/* Members Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>멤버 관리</h2>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm border"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          >
            <option value="">모든 역할</option>
            <option value="OWNER">소유자</option>
            <option value="ADMIN">관리자</option>
            <option value="MEMBER">멤버</option>
            <option value="GUEST">게스트</option>
            {customRoles?.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>사용자</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>역할</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>참여일</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                        {member.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <div style={{ color: "var(--text-primary)" }}>{member.user?.name ?? "Unknown"}</div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{member.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => updateRole.mutate({
                          workspaceId,
                          memberId: member.id,
                          role: e.target.value as "ADMIN" | "MEMBER" | "GUEST",
                          customRoleId: member.customRole?.id ?? null,
                        })}
                        disabled={member.role === "OWNER"}
                        className="px-2 py-1 rounded text-xs border"
                        style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                      >
                        <option value="ADMIN">관리자</option>
                        <option value="MEMBER">멤버</option>
                        <option value="GUEST">게스트</option>
                        {member.role === "OWNER" && <option value="OWNER">소유자</option>}
                      </select>
                      <select
                        value={member.customRole?.id ?? ""}
                        onChange={(e) => updateRole.mutate({
                          workspaceId,
                          memberId: member.id,
                          role: member.role as "ADMIN" | "MEMBER" | "GUEST",
                          customRoleId: e.target.value || null,
                        })}
                        disabled={member.role === "OWNER"}
                        className="px-2 py-1 rounded text-xs border"
                        style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                      >
                        <option value="">커스텀 역할 없음</option>
                        {customRoles?.map((role) => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {new Date(member.joinedAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {member.role !== "OWNER" && (
                      <button
                        onClick={() => {
                          if (confirm("이 멤버를 제거하시겠습니까?")) {
                            removeMember.mutate({ workspaceId, memberId: member.id });
                          }
                        }}
                        className="text-xs px-2 py-1 rounded hover:opacity-80"
                        style={{ color: "#e74c3c" }}
                      >
                        제거
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
