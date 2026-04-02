"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AccountSettings } from "./account-settings";
import { WorkspaceSettings } from "./workspace-settings";
import { SessionManagement } from "./session-management";
import { TwoFactorSettings } from "./two-factor-settings";
import { BackupSettings } from "./backup-settings";
import { McpSettings } from "./mcp-settings";
import { IntegrationSettings } from "./integration-settings";

type Tab = "account" | "workspace" | "sessions" | "2fa" | "backup" | "integrations";
const tabs: { id: Tab; label: string; section?: string }[] = [
  { id: "account", label: "내 계정", section: "설정" },
  { id: "workspace", label: "워크스페이스" },
  { id: "sessions", label: "세션 관리", section: "보안" },
  { id: "2fa", label: "2단계 인증" },
  { id: "backup", label: "백업 및 복원", section: "데이터" },
  { id: "integrations", label: "통합 (MCP)", section: "통합" },
];

export function SettingsLayout({ workspaceId }: { workspaceId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  return (
    <div className="flex h-full">
      <div className="w-[240px] flex-shrink-0 py-4 px-2" style={{ borderRight: "1px solid var(--border-default)" }}>
        {tabs.map((tab) => (
          <div key={tab.id}>
            {tab.section && (
              <div className="px-3 py-1 mb-2 mt-4 first:mt-0" style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {tab.section}
              </div>
            )}
            <button
              onClick={() => setActiveTab(tab.id)}
              className={cn("w-full text-left px-3 py-1.5 rounded text-sm", activeTab === tab.id ? "bg-notion-bg-active font-medium" : "hover:bg-notion-bg-hover")}
              style={{ color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              {tab.label}
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto py-8 px-12">
        {activeTab === "account" && <AccountSettings />}
        {activeTab === "workspace" && <WorkspaceSettings workspaceId={workspaceId} />}
        {activeTab === "sessions" && <SessionManagement />}
        {activeTab === "2fa" && <TwoFactorSettings />}
        {activeTab === "backup" && <BackupSettings workspaceId={workspaceId} />}
        {activeTab === "integrations" && (
          <div>
            <IntegrationSettings workspaceId={workspaceId} />
            <section className="mt-8">
              <McpSettings />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
