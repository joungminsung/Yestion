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

      {/* API 키 관리 */}
      <ApiKeySection workspaceId={workspaceId} />
    </div>
  );
}

function ApiKeySection({ workspaceId }: { workspaceId: string }) {
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data: apiKeys } = trpc.apiKey.list.useQuery({ workspaceId });
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const createApiKey = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      utils.apiKey.list.invalidate({ workspaceId });
      addToast({ message: "API 키가 생성되었습니다. 키를 복사하세요!", type: "success" });
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const revokeApiKey = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate({ workspaceId });
      addToast({ message: "API 키가 삭제되었습니다", type: "success" });
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({ message: "클립보드에 복사되었습니다", type: "success" });
  };

  return (
    <section className="mb-8">
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>API 키</h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
        REST API 및 MCP 서버에서 사용할 API 키를 관리합니다.
      </p>

      {/* Created key alert - shown only once */}
      {createdKey && (
        <div
          className="mb-4 p-3 rounded-md border text-sm"
          style={{
            backgroundColor: "var(--color-green-bg, #ecfdf5)",
            borderColor: "var(--color-green, #10b981)",
            color: "var(--text-primary)",
          }}
        >
          <div className="font-medium mb-1">API 키가 생성되었습니다</div>
          <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            이 키는 다시 표시되지 않습니다. 지금 복사하세요.
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 px-2 py-1 rounded text-xs"
              style={{ backgroundColor: "var(--bg-secondary)", fontFamily: "monospace" }}
            >
              {createdKey}
            </code>
            <Button size="sm" onClick={() => copyToClipboard(createdKey)}>
              복사
            </Button>
            <Button size="sm" onClick={() => setCreatedKey(null)}>
              닫기
            </Button>
          </div>
        </div>
      )}

      {/* Existing keys */}
      <div className="flex flex-col gap-1 mb-4">
        {apiKeys?.length === 0 && (
          <div className="text-xs py-2" style={{ color: "var(--text-tertiary)" }}>
            아직 생성된 API 키가 없습니다.
          </div>
        )}
        {apiKeys?.map((apiKey) => (
          <div
            key={apiKey.id}
            className="flex items-center justify-between px-3 py-2 rounded"
            style={{ fontSize: "14px" }}
          >
            <div className="flex items-center gap-3">
              <div>
                <div style={{ color: "var(--text-primary)" }}>{apiKey.name}</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs" style={{ color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                    {apiKey.key}
                  </code>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(apiKey.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => revokeApiKey.mutate({ id: apiKey.id, workspaceId })}
              style={{ color: "var(--color-red, #ef4444)" }}
            >
              삭제
            </Button>
          </div>
        ))}
      </div>

      {/* Create new key */}
      <div className="flex gap-2 max-w-[400px]">
        <Input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="API 키 이름 (예: MCP 서버)"
        />
        <Button
          onClick={() => createApiKey.mutate({ workspaceId, name: newKeyName })}
          disabled={!newKeyName.trim()}
        >
          새 API 키 생성
        </Button>
      </div>
    </section>
  );
}
