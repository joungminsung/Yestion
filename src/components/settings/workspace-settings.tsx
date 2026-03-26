"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

export function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: memberships } = trpc.workspace.list.useQuery();
  const workspace = memberships?.find((m) => m.workspaceId === workspaceId)?.workspace;
  const { data: members } = trpc.workspace.members.useQuery({ workspaceId }, { enabled: !!workspaceId });
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    if (workspace) setName(workspace.name);
  }, [workspace]);

  const updateWorkspace = trpc.workspace.update.useMutation({
    onSuccess: () => addToast({ message: "워크스페이스가 업데이트되었습니다", type: "success" }),
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const inviteMember = trpc.workspace.inviteMember.useMutation({
    onSuccess: () => { addToast({ message: "멤버를 초대했습니다", type: "success" }); setInviteEmail(""); },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  if (!workspace) return null;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>워크스페이스</h2>
      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>워크스페이스 정보</h3>
        <div className="flex flex-col gap-3 max-w-[400px]">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={() => updateWorkspace.mutate({ id: workspaceId, name })} size="md" className="self-start">저장</Button>
        </div>
      </section>
      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>멤버 ({members?.length ?? 0})</h3>
        <div className="flex flex-col gap-1 mb-4">
          {members?.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-3 py-2 rounded" style={{ fontSize: "14px" }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: "var(--color-blue-bg)", color: "var(--color-blue)" }}>
                  {member.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: "var(--text-primary)" }}>{member.user.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{member.user.email}</div>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>{member.role}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 max-w-[400px]">
          <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="이메일로 초대" type="email" />
          <Button onClick={() => inviteMember.mutate({ workspaceId, email: inviteEmail, role: "MEMBER" })} disabled={!inviteEmail}>초대</Button>
        </div>
      </section>
    </div>
  );
}
