"use client";

import React, { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Plus, Trash2, Check, X } from "lucide-react";
import type { WorkspacePermissionKey } from "@/lib/permissions";

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

  const categories = Array.from(new Set(permissionDefs?.map((p) => p.category) ?? []));

  const togglePermission = (roleId: string, currentPerms: WorkspacePermissionKey[], permKey: WorkspacePermissionKey) => {
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
                <React.Fragment key={`cat-${cat}`}>
                  <tr>
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
                        const perms = (role.permissions as WorkspacePermissionKey[]) ?? [];
                        const checked = perms.includes(perm.key as WorkspacePermissionKey);
                        return (
                          <td key={role.id} className="text-center px-4 py-2.5">
                            <button
                              onClick={() => togglePermission(role.id, perms, perm.key as WorkspacePermissionKey)}
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
                </React.Fragment>
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
