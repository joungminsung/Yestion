"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AccountSettings } from "./account-settings";
import { WorkspaceSettings } from "./workspace-settings";

type Tab = "account" | "workspace";
const tabs: { id: Tab; label: string }[] = [
  { id: "account", label: "내 계정" },
  { id: "workspace", label: "워크스페이스" },
];

export function SettingsLayout({ workspaceId }: { workspaceId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  return (
    <div className="flex h-full">
      <div className="w-[240px] flex-shrink-0 py-4 px-2" style={{ borderRight: "1px solid var(--border-default)" }}>
        <div className="px-3 py-1 mb-2" style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          설정
        </div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn("w-full text-left px-3 py-1.5 rounded text-sm", activeTab === tab.id ? "bg-notion-bg-active font-medium" : "hover:bg-notion-bg-hover")}
            style={{ color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)" }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto py-8 px-12">
        {activeTab === "account" && <AccountSettings />}
        {activeTab === "workspace" && <WorkspaceSettings workspaceId={workspaceId} />}
      </div>
    </div>
  );
}
