"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { useTranslations } from "next-intl";
import { X, UserPlus, Trash2, Crown } from "lucide-react";

export function TeamspaceSettingsModal({
  teamspaceId,
  workspaceId,
  onClose,
}: {
  teamspaceId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const t = useTranslations("sidebar");
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const { data: teamspace } = trpc.teamspace.get.useQuery({ id: teamspaceId });
  const { data: workspaceMembers } = trpc.workspace.members.useQuery({ workspaceId });

  const [name, setName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (teamspace && !nameInitialized) {
      setName(teamspace.name);
      setNameInitialized(true);
    }
  }, [teamspace, nameInitialized]);

  const updateTeamspace = trpc.teamspace.update.useMutation({
    onSuccess: () => {
      utils.teamspace.list.invalidate();
      utils.teamspace.get.invalidate({ id: teamspaceId });
      addToast({ message: t("teamspaceUpdated"), type: "success" });
    },
  });

  const deleteTeamspace = trpc.teamspace.delete.useMutation({
    onSuccess: () => {
      utils.teamspace.list.invalidate();
      utils.page.list.invalidate();
      addToast({ message: t("teamspaceDeleted"), type: "info" });
      onClose();
    },
  });

  const addMember = trpc.teamspace.addMember.useMutation({
    onSuccess: () => {
      utils.teamspace.get.invalidate({ id: teamspaceId });
      utils.teamspace.list.invalidate();
      setAddEmail("");
      addToast({ message: t("memberAdded"), type: "success" });
    },
    onError: (err) => {
      addToast({ message: err.message, type: "error" });
    },
  });

  const removeMember = trpc.teamspace.removeMember.useMutation({
    onSuccess: () => {
      utils.teamspace.get.invalidate({ id: teamspaceId });
      utils.teamspace.list.invalidate();
      addToast({ message: t("memberRemoved"), type: "info" });
    },
  });

  const handleAddMember = () => {
    if (!addEmail.trim() || !workspaceMembers) return;
    const found = workspaceMembers.find(
      (m: { user: { email: string } }) => m.user.email.toLowerCase() === addEmail.trim().toLowerCase()
    );
    if (!found) {
      addToast({ message: t("memberNotFound"), type: "error" });
      return;
    }
    addMember.mutate({ teamspaceId, userId: found.user.id });
  };

  if (!teamspace) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative rounded-xl w-[480px] max-h-[80vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
          border: "1px solid var(--border-default)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-divider)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("teamspaceSettings")}
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("name")}
            </label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={() => name.trim() && updateTeamspace.mutate({ id: teamspaceId, name: name.trim() })}
                disabled={!name.trim() || name === teamspace.name}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: name.trim() && name !== teamspace.name ? "#2383e2" : "var(--bg-secondary)",
                  color: name.trim() && name !== teamspace.name ? "#fff" : "var(--text-tertiary)",
                }}
              >
                {t("save")}
              </button>
            </div>
          </div>

          {/* Members */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("teamspaceMemberCount")} ({teamspace.members.length})
            </label>

            {/* Add member */}
            <div className="flex gap-2 mb-3">
              <input
                ref={addInputRef}
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddMember();
                }}
                placeholder={t("addMemberByEmail")}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleAddMember}
                className="px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                style={{
                  backgroundColor: "#2383e2",
                  color: "#fff",
                }}
              >
                <UserPlus size={14} />
                {t("add")}
              </button>
            </div>

            {/* Member list */}
            <div className="space-y-1">
              {teamspace.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: "var(--bg-secondary)" }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor: "var(--bg-hover)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {member.user.avatarUrl ? (
                      <img src={member.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      member.user.name?.charAt(0)?.toUpperCase() || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                      {member.user.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                      {member.user.email}
                    </div>
                  </div>
                  {member.role === "OWNER" || member.role === "owner" ? (
                    <Crown size={14} style={{ color: "#e8a838", flexShrink: 0 }} />
                  ) : (
                    <button
                      onClick={() => removeMember.mutate({ teamspaceId, userId: member.user.id })}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover flex-shrink-0"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Delete */}
          <div className="pt-4 border-t" style={{ borderColor: "var(--border-divider)" }}>
            <button
              onClick={() => {
                if (confirm(t("deleteTeamspaceConfirm"))) {
                  deleteTeamspace.mutate({ id: teamspaceId });
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-950/20"
              style={{ color: "#e03e3e" }}
            >
              <Trash2 size={14} />
              {t("deleteTeamspace")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
