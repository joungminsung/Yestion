# Admin & Security + Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audit log dashboard, admin dashboard, custom RBAC, and full offline/PWA support to the Notion clone.
**Architecture:** Audit and admin dashboards are new settings sub-pages under `[workspaceId]/settings/` consuming tRPC routers. Custom RBAC adds a `Role` model to Prisma with a permission matrix UI. Offline support uses next-pwa (Workbox) for service worker caching, idb-keyval for IndexedDB page cache, and a sync queue for conflict-free offline edits.
**Tech Stack:** recharts, idb-keyval, next-pwa, Workbox, Prisma, tRPC, zustand

---

### Task 1: Audit Log Dashboard
**Files:**
- Modify: `src/server/routers/activity.ts`
- Create: `src/app/(main)/[workspaceId]/settings/audit-log/page.tsx`

- [ ] **Step 1: Extend activity router with workspace-level listing, filters, and CSV export**
In `src/server/routers/activity.ts`, add two new procedures:

```typescript
// Add to activityRouter in src/server/routers/activity.ts

  workspaceList: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        action: z.string().optional(),
        userId: z.string().optional(),
        search: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        page: { workspaceId: input.workspaceId },
      };
      if (input.action) where.action = input.action;
      if (input.userId) where.userId = input.userId;
      if (input.search) where.action = { contains: input.search, mode: "insensitive" };
      if (input.from || input.to) {
        where.createdAt = {};
        if (input.from) where.createdAt.gte = new Date(input.from);
        if (input.to) where.createdAt.lte = new Date(input.to);
      }

      const items = await ctx.db.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          page: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }
      return { items, nextCursor };
    }),

  dailyCounts: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        days: z.number().min(7).max(90).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const logs = await ctx.db.activityLog.findMany({
        where: {
          page: { workspaceId: input.workspaceId },
          createdAt: { gte: since },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const counts: Record<string, number> = {};
      logs.forEach((l) => {
        const day = l.createdAt.toISOString().slice(0, 10);
        counts[day] = (counts[day] || 0) + 1;
      });
      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    }),
```

- [ ] **Step 2: Create audit log dashboard page**
Create `src/app/(main)/[workspaceId]/settings/audit-log/page.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, Search, Filter } from "lucide-react";

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
```

- [ ] **Step 3: Install recharts**
```bash
npm install recharts
```

- [ ] **Step 4: Commit**
```
feat: add audit log dashboard with filters, chart, and CSV export
```

---

### Task 2: Admin Dashboard
**Files:**
- Create: `src/app/(main)/[workspaceId]/settings/admin/page.tsx`

- [ ] **Step 1: Create admin dashboard page with stats widgets and user management**
Create `src/app/(main)/[workspaceId]/settings/admin/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { Users, FileText, Database, Shield, MoreHorizontal } from "lucide-react";

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

  const { data: members, refetch } = trpc.workspace.members.useQuery({ workspaceId });
  const { data: wsData } = trpc.workspace.get.useQuery({ id: workspaceId });
  const updateRole = trpc.workspace.updateMemberRole.useMutation({ onSuccess: () => refetch() });
  const removeMember = trpc.workspace.removeMember.useMutation({ onSuccess: () => refetch() });

  const filteredMembers = members?.filter((m: any) => !roleFilter || m.role === roleFilter) ?? [];

  const stats = {
    totalMembers: members?.length ?? 0,
    admins: members?.filter((m: any) => m.role === "ADMIN" || m.role === "OWNER").length ?? 0,
    guests: members?.filter((m: any) => m.role === "GUEST").length ?? 0,
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>관리자 대시보드</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={18} style={{ color: "#2383e2" }} />} label="전체 멤버" value={stats.totalMembers} />
        <StatCard icon={<Shield size={18} style={{ color: "#e2832383" }} />} label="관리자" value={stats.admins} />
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
              {filteredMembers.map((member: any) => (
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
                    <select
                      value={member.role}
                      onChange={(e) => updateRole.mutate({ workspaceId, memberId: member.id, role: e.target.value as any })}
                      disabled={member.role === "OWNER"}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                    >
                      <option value="ADMIN">관리자</option>
                      <option value="MEMBER">멤버</option>
                      <option value="GUEST">게스트</option>
                      {member.role === "OWNER" && <option value="OWNER">소유자</option>}
                    </select>
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
```

- [ ] **Step 2: Add workspace.members, workspace.get, workspace.updateMemberRole, workspace.removeMember procedures if missing**
Verify these exist in `src/server/routers/workspace.ts` and add any that are missing. At minimum you need:

```typescript
// Add to workspaceRouter in src/server/routers/workspace.ts

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workspace.findUniqueOrThrow({ where: { id: input.id } });
    }),

  members: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      });
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({ workspaceId: z.string(), memberId: z.string(), role: z.enum(["ADMIN", "MEMBER", "GUEST"]) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workspaceMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ workspaceId: z.string(), memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workspaceMember.delete({ where: { id: input.memberId } });
    }),
```

- [ ] **Step 3: Commit**
```
feat: add admin dashboard with stats widgets and member management
```

---

### Task 3: Custom RBAC
**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/server/routers/role.ts`
- Modify: `src/server/trpc/router.ts`
- Create: `src/components/settings/role-settings.tsx`

- [ ] **Step 1: Add Role model to Prisma schema**
In `prisma/schema.prisma`, add:

```prisma
model CustomRole {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  permissions Json     @default("[]")
  isBuiltIn   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, name])
}
```

Also add `customRoles CustomRole[]` to the `Workspace` model's relations.

- [ ] **Step 2: Run Prisma migration**
```bash
npx prisma migrate dev --name add-custom-role
```

- [ ] **Step 3: Create role router**
Create `src/server/routers/role.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

const PERMISSIONS = [
  "page.create", "page.edit", "page.delete", "page.share",
  "member.invite", "member.remove", "member.changeRole",
  "workspace.settings", "workspace.billing",
  "database.create", "database.edit", "database.delete",
  "automation.manage", "webhook.manage", "apikey.manage",
] as const;

export const roleRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.customRole.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(50),
        permissions: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customRole.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          permissions: input.permissions,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        permissions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.customRole.findUniqueOrThrow({ where: { id: input.id } });
      if (role.isBuiltIn) throw new Error("Built-in roles cannot be modified");
      return ctx.db.customRole.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.permissions ? { permissions: input.permissions } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.customRole.findUniqueOrThrow({ where: { id: input.id } });
      if (role.isBuiltIn) throw new Error("Built-in roles cannot be deleted");
      return ctx.db.customRole.delete({ where: { id: input.id } });
    }),

  permissions: protectedProcedure.query(() => {
    return PERMISSIONS.map((p) => ({
      key: p,
      category: p.split(".")[0],
      action: p.split(".")[1],
    }));
  }),
});
```

- [ ] **Step 4: Register role router in tRPC**
In `src/server/trpc/router.ts`, add:

```typescript
import { roleRouter } from "@/server/routers/role";

// Inside the router() call, add:
  role: roleRouter,
```

- [ ] **Step 5: Create permission matrix UI**
Create `src/components/settings/role-settings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Plus, Trash2, Check, X } from "lucide-react";

interface RoleSettingsProps {
  workspaceId: string;
}

export function RoleSettings({ workspaceId }: RoleSettingsProps) {
  const [newRoleName, setNewRoleName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: roles, refetch } = trpc.role.list.useQuery({ workspaceId });
  const { data: permissionDefs } = trpc.role.permissions.useQuery();
  const createRole = trpc.role.create.useMutation({ onSuccess: () => { refetch(); setNewRoleName(""); setShowCreate(false); } });
  const updateRole = trpc.role.update.useMutation({ onSuccess: () => refetch() });
  const deleteRole = trpc.role.delete.useMutation({ onSuccess: () => refetch() });

  const categories = [...new Set(permissionDefs?.map((p) => p.category) ?? [])];

  const togglePermission = (roleId: string, currentPerms: string[], permKey: string) => {
    const newPerms = currentPerms.includes(permKey)
      ? currentPerms.filter((p) => p !== permKey)
      : [...currentPerms, permKey];
    updateRole.mutate({ id: roleId, permissions: newPerms });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>커스텀 역할</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>워크스페이스의 권한을 세밀하게 관리하세요.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
          style={{ backgroundColor: "#2383e2", color: "white" }}
        >
          <Plus size={14} /> 역할 추가
        </button>
      </div>

      {showCreate && (
        <div className="flex gap-2 items-center p-3 rounded-lg border" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="역할 이름"
            className="flex-1 px-3 py-1.5 rounded text-sm border"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
          <button onClick={() => createRole.mutate({ workspaceId, name: newRoleName, permissions: [] })} disabled={!newRoleName.trim()} className="p-1.5 rounded" style={{ color: "#27ae60" }}>
            <Check size={16} />
          </button>
          <button onClick={() => setShowCreate(false)} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Permission Matrix */}
      {roles && roles.length > 0 && (
        <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                <th className="text-left px-4 py-3 font-medium sticky left-0" style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>
                  권한
                </th>
                {roles.map((role) => (
                  <th key={role.id} className="px-4 py-3 font-medium text-center min-w-[120px]" style={{ color: "var(--text-primary)" }}>
                    <div className="flex items-center justify-center gap-1">
                      {role.name}
                      {!role.isBuiltIn && (
                        <button onClick={() => { if (confirm("이 역할을 삭제하시겠습니까?")) deleteRole.mutate({ id: role.id }); }} className="ml-1 opacity-50 hover:opacity-100">
                          <Trash2 size={12} style={{ color: "#e74c3c" }} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <>
                  <tr key={`cat-${cat}`}>
                    <td colSpan={1 + (roles?.length ?? 0)} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                      {cat}
                    </td>
                  </tr>
                  {permissionDefs?.filter((p) => p.category === cat).map((perm) => (
                    <tr key={perm.key} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                      <td className="px-4 py-2.5 sticky left-0" style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}>
                        {perm.key}
                      </td>
                      {roles.map((role) => {
                        const perms = (role.permissions as string[]) ?? [];
                        const checked = perms.includes(perm.key);
                        return (
                          <td key={role.id} className="text-center px-4 py-2.5">
                            <button
                              onClick={() => togglePermission(role.id, perms, perm.key)}
                              disabled={role.isBuiltIn}
                              className="w-5 h-5 rounded border inline-flex items-center justify-center"
                              style={{
                                borderColor: checked ? "#2383e2" : "var(--border-default)",
                                backgroundColor: checked ? "#2383e2" : "transparent",
                              }}
                            >
                              {checked && <Check size={12} color="white" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!roles || roles.length === 0) && !showCreate && (
        <div className="text-center py-12" style={{ color: "var(--text-secondary)" }}>
          <p>아직 커스텀 역할이 없습니다. 역할을 추가하여 시작하세요.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**
```
feat: add custom RBAC with Role model, router, and permission matrix UI
```

---

### Task 4: Offline Support - Service Worker & Caching
**Files:**
- Modify: `next.config.mjs`
- Create: `public/manifest.json`
- Create: `src/lib/offline/cache-manager.ts`
- Create: `src/lib/offline/sync-queue.ts`

- [ ] **Step 1: Install dependencies**
```bash
npm install next-pwa idb-keyval
```

- [ ] **Step 2: Update next.config.mjs for next-pwa**
Wrap the existing config in `next.config.mjs`:

```javascript
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "next-pwa";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config, { dev }) => {
    if (dev) {
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [/^(.+?[\\/]node_modules[\\/])/],
      };
      config.module.rules.push({
        test: /next-intl.*extractor.*format.*index\.js$/,
        resolve: { fullySpecified: false },
      });
    }
    return config;
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tiptap/core",
      "@tiptap/react",
      "@tiptap/starter-kit",
    ],
  },
};

export default withPWA(withNextIntl(nextConfig));
```

- [ ] **Step 3: Create PWA manifest**
Create `public/manifest.json`:

```json
{
  "name": "Notion Web",
  "short_name": "Notion Web",
  "description": "A Notion-like collaborative workspace",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2383e2",
  "orientation": "any",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Create IndexedDB cache manager**
Create `src/lib/offline/cache-manager.ts`:

```typescript
import { get, set, del, keys, clear } from "idb-keyval";

export interface CachedPage {
  id: string;
  title: string;
  content: any;
  updatedAt: string;
  workspaceId: string;
}

const PAGE_PREFIX = "page:";
const QUEUE_KEY = "sync-queue";

export const cacheManager = {
  async getPage(pageId: string): Promise<CachedPage | undefined> {
    return get<CachedPage>(`${PAGE_PREFIX}${pageId}`);
  },

  async setPage(page: CachedPage): Promise<void> {
    await set(`${PAGE_PREFIX}${page.id}`, page);
  },

  async deletePage(pageId: string): Promise<void> {
    await del(`${PAGE_PREFIX}${pageId}`);
  },

  async getAllPages(): Promise<CachedPage[]> {
    const allKeys = await keys();
    const pageKeys = allKeys.filter((k) => String(k).startsWith(PAGE_PREFIX));
    const pages: CachedPage[] = [];
    for (const key of pageKeys) {
      const page = await get<CachedPage>(key);
      if (page) pages.push(page);
    }
    return pages;
  },

  async getPagesByWorkspace(workspaceId: string): Promise<CachedPage[]> {
    const all = await this.getAllPages();
    return all.filter((p) => p.workspaceId === workspaceId);
  },

  async clearAll(): Promise<void> {
    await clear();
  },

  async getCacheSize(): Promise<number> {
    const allKeys = await keys();
    return allKeys.filter((k) => String(k).startsWith(PAGE_PREFIX)).length;
  },
};
```

- [ ] **Step 5: Create offline sync queue**
Create `src/lib/offline/sync-queue.ts`:

```typescript
import { get, set } from "idb-keyval";

export interface SyncOperation {
  id: string;
  type: "create" | "update" | "delete";
  entity: "page" | "block";
  entityId: string;
  payload: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = "offline-sync-queue";

export const syncQueue = {
  async getQueue(): Promise<SyncOperation[]> {
    return (await get<SyncOperation[]>(QUEUE_KEY)) ?? [];
  },

  async enqueue(op: Omit<SyncOperation, "id" | "timestamp" | "retries">): Promise<void> {
    const queue = await this.getQueue();
    queue.push({
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    });
    await set(QUEUE_KEY, queue);
  },

  async dequeue(id: string): Promise<void> {
    const queue = await this.getQueue();
    await set(
      QUEUE_KEY,
      queue.filter((op) => op.id !== id),
    );
  },

  async incrementRetry(id: string): Promise<void> {
    const queue = await this.getQueue();
    const op = queue.find((o) => o.id === id);
    if (op) {
      op.retries += 1;
      await set(QUEUE_KEY, queue);
    }
  },

  async flush(
    executor: (op: SyncOperation) => Promise<boolean>,
  ): Promise<{ success: number; failed: number }> {
    const queue = await this.getQueue();
    let success = 0;
    let failed = 0;

    for (const op of queue) {
      if (op.retries >= 5) {
        failed++;
        continue;
      }
      try {
        const ok = await executor(op);
        if (ok) {
          await this.dequeue(op.id);
          success++;
        } else {
          await this.incrementRetry(op.id);
          failed++;
        }
      } catch {
        await this.incrementRetry(op.id);
        failed++;
      }
    }
    return { success, failed };
  },

  async clear(): Promise<void> {
    await set(QUEUE_KEY, []);
  },

  async size(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};
```

- [ ] **Step 6: Commit**
```
feat: add offline support with next-pwa, IndexedDB cache, and sync queue
```

---

### Task 5: Offline UI
**Files:**
- Create: `src/components/ui/offline-banner.tsx`
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Create offline banner component**
Create `src/components/ui/offline-banner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, CloudOff } from "lucide-react";
import { syncQueue } from "@/lib/offline/sync-queue";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOps, setPendingOps] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Show briefly then hide
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check queue size periodically
    const interval = setInterval(async () => {
      const size = await syncQueue.size();
      setPendingOps(size);
    }, 5000);

    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm transition-all duration-300"
      style={{
        backgroundColor: isOnline ? "#27ae6020" : "#e74c3c20",
        color: isOnline ? "#27ae60" : "#e74c3c",
      }}
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>온라인으로 복원되었습니다.</span>
          {pendingOps > 0 && <span>({pendingOps}개 변경사항 동기화 중...)</span>}
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>오프라인 상태입니다. 변경사항은 로컬에 저장됩니다.</span>
          {pendingOps > 0 && (
            <span className="flex items-center gap-1">
              <CloudOff size={12} /> {pendingOps}개 대기 중
            </span>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add offline banner to main layout**
In `src/app/(main)/layout.tsx`, import and add the `OfflineBanner` component:

```tsx
import { OfflineBanner } from "@/components/ui/offline-banner";

// Inside the return, add before the <main> tag:
// <OfflineBanner />
```

The full return becomes:
```tsx
  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <OfflineBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main id="main-content" role="main" aria-label="페이지 콘텐츠" className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
        <CommandPalette />
        <QuickNoteButton />
      </div>
    </div>
  );
```

- [ ] **Step 3: Commit**
```
feat: add offline banner with connection status and pending sync count
```

---

### Task 6: PWA Install Prompt
**Files:**
- Create: `src/components/ui/pwa-install-prompt.tsx`
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Create PWA install prompt component**
Create `src/components/ui/pwa-install-prompt.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a brief delay so it doesn't feel jarring
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  }, []);

  if (!showPrompt || dismissed) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg shadow-lg border px-4 py-3 max-w-sm animate-in slide-in-from-bottom-4"
      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "#2383e215" }}
      >
        <Download size={20} style={{ color: "#2383e2" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          앱으로 설치
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          더 빠른 접근과 오프라인 지원을 위해 설치하세요.
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: "#2383e2", color: "white" }}
        >
          설치
        </button>
        <button onClick={handleDismiss} className="p-1 rounded" style={{ color: "var(--text-secondary)" }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add PWA install prompt to main layout**
In `src/app/(main)/layout.tsx`, add the import and component:

```tsx
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";

// Add before the closing </div> of the root container:
// <PWAInstallPrompt />
```

- [ ] **Step 3: Commit**
```
feat: add PWA install prompt with beforeinstallprompt handler
```
