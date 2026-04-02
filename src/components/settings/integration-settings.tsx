"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import {
  MessageSquare,
  GitBranch,
  CalendarDays,
  Mail,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
  Settings,
} from "lucide-react";

const SERVICE_ICONS: Record<string, typeof MessageSquare> = {
  MessageSquare,
  Github: GitBranch,
  CalendarDays,
  Mail,
};

const STATUS_LABELS: { [key: string]: { label: string; color: string } } = {
  CONNECTED: { label: "Connected", color: "var(--color-green)" },
  DISCONNECTED: { label: "Disconnected", color: "var(--text-tertiary)" },
  ERROR: { label: "Error", color: "var(--color-red)" },
  PENDING: { label: "Connecting...", color: "var(--color-yellow)" },
};

type Props = {
  workspaceId: string;
};

export function IntegrationSettings({ workspaceId }: Props) {
  const { data: integrations, refetch } = trpc.integration.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const connectMutation = trpc.integration.connect.useMutation();
  const disconnectMutation = trpc.integration.disconnect.useMutation({
    onSuccess: () => refetch(),
  });
  const updateConfigMutation = trpc.integration.updateConfig.useMutation({
    onSuccess: () => refetch(),
  });

  const [configuring, setConfiguring] = useState<string | null>(null);

  const handleConnect = async (service: string) => {
    const result = await connectMutation.mutateAsync({
      workspaceId,
      service: service as "SLACK" | "GITHUB" | "GOOGLE_CALENDAR" | "EMAIL",
    });
    if (result.oauthUrl) {
      window.location.href = result.oauthUrl;
    } else {
      // For services that don't use OAuth (email), mark as connected
      refetch();
    }
  };

  const handleDisconnect = (service: string) => {
    if (confirm("Are you sure you want to disconnect this integration?")) {
      disconnectMutation.mutate({ workspaceId, service: service as "SLACK" | "GITHUB" | "GOOGLE_CALENDAR" | "EMAIL" });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Integrations
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
        Connect external services to your workspace
      </p>

      <div className="grid gap-4">
        {integrations?.map(({ service, info, integration }) => {
          const Icon = SERVICE_ICONS[info.icon] ?? Settings;
          const isConnected = integration?.status === "CONNECTED";
          const status = STATUS_LABELS[integration?.status ?? "DISCONNECTED"] ?? { label: "Disconnected", color: "var(--text-tertiary)" };

          return (
            <div
              key={service}
              className="p-4 rounded-lg border"
              style={{ borderColor: "var(--border-default)" }}
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                <div
                  className="p-2.5 rounded-lg shrink-0"
                  style={{ backgroundColor: "var(--bg-hover)" }}
                >
                  <Icon size={20} style={{ color: "var(--text-primary)" }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {info.name}
                    </h3>
                    {/* Status badge */}
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{
                        color: status.color,
                        backgroundColor: `${status.color}15`,
                      }}
                    >
                      {integration?.status === "CONNECTED" && <Check size={10} />}
                      {integration?.status === "ERROR" && <AlertCircle size={10} />}
                      {integration?.status === "PENDING" && <Loader2 size={10} className="animate-spin" />}
                      {status.label}
                    </span>
                  </div>

                  <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
                    {info.description}
                  </p>

                  {/* Features list */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    {info.features.map((feature: string, i: number) => (
                      <span key={i} className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--color-green)" }}>&#8226;</span>
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Connected info */}
                  {isConnected && integration.externalName && (
                    <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                      Connected as <strong>{integration.externalName}</strong>
                      {integration.connectedAt && (
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {" "}
                          &middot; {new Date(integration.connectedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => setConfiguring(configuring === service ? null : service)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border"
                          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                        >
                          <Settings size={12} />
                          Configure
                        </button>
                        <button
                          onClick={() => handleDisconnect(service)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border"
                          style={{ borderColor: "var(--color-red)", color: "var(--color-red)" }}
                          disabled={disconnectMutation.isPending}
                        >
                          <X size={12} />
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(service)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded"
                        style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
                        disabled={connectMutation.isPending}
                      >
                        <ExternalLink size={12} />
                        {info.requiresOAuth ? "Connect with OAuth" : "Enable"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Per-service config panel */}
              {configuring === service && isConnected && (
                <div
                  className="mt-4 pt-4 border-t"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <ServiceConfig
                    service={service}
                    config={(integration.config as Record<string, unknown>) ?? {}}
                    onSave={(newConfig) => {
                      updateConfigMutation.mutate({
                        workspaceId,
                        service: service as "SLACK" | "GITHUB" | "GOOGLE_CALENDAR" | "EMAIL",
                        config: newConfig,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Per-service configuration forms */
function ServiceConfig({
  service,
  config,
  onSave,
}: {
  service: string;
  config: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  const updateField = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-3">
      {service === "SLACK" && (
        <>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Default Channel
            </label>
            <input
              value={(localConfig.defaultChannel as string) ?? ""}
              onChange={(e) => updateField("defaultChannel", e.target.value)}
              placeholder="#general"
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.notifyOnTaskComplete as boolean) ?? true}
              onChange={(e) => updateField("notifyOnTaskComplete", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Notify when tasks are completed
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.notifyOnPageEdit as boolean) ?? false}
              onChange={(e) => updateField("notifyOnPageEdit", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Notify on page edits
            </label>
          </div>
        </>
      )}

      {service === "GITHUB" && (
        <>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Repository (owner/repo)
            </label>
            <input
              value={(localConfig.repository as string) ?? ""}
              onChange={(e) => updateField("repository", e.target.value)}
              placeholder="org/repo"
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.syncIssues as boolean) ?? true}
              onChange={(e) => updateField("syncIssues", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Create tasks from GitHub issues
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.prNotifications as boolean) ?? true}
              onChange={(e) => updateField("prNotifications", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Pull request notifications
            </label>
          </div>
        </>
      )}

      {service === "GOOGLE_CALENDAR" && (
        <>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Calendar ID
            </label>
            <input
              value={(localConfig.calendarId as string) ?? "primary"}
              onChange={(e) => updateField("calendarId", e.target.value)}
              placeholder="primary"
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.autoCreateEvents as boolean) ?? true}
              onChange={(e) => updateField("autoCreateEvents", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Auto-create events for tasks with due dates
            </label>
          </div>
        </>
      )}

      {service === "EMAIL" && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.taskAssignmentEmails as boolean) ?? true}
              onChange={(e) => updateField("taskAssignmentEmails", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Send email on task assignment
            </label>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Digest Frequency
            </label>
            <select
              value={(localConfig.digestFrequency as string) ?? "weekly"}
              onChange={(e) => updateField("digestFrequency", e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </>
      )}

      <div className="flex justify-end mt-2">
        <button
          onClick={() => onSave(localConfig)}
          className="px-3 py-1.5 text-xs rounded"
          style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}
