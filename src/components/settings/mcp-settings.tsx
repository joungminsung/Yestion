"use client";

import { useState } from "react";
import { Plus, Server, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useToastStore } from "@/stores/toast";

type McpServer = {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  status: "connected" | "disconnected" | "error";
  toolCount: number;
  error?: string;
};

const STORAGE_KEY = "notion-mcp-servers";

function loadServers(): McpServer[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveServers(servers: McpServer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  } catch {}
}

export function McpSettings() {
  const [servers, setServers] = useState<McpServer[]>(loadServers);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [jsonConfig, setJsonConfig] = useState("");
  const addToast = useToastStore((s) => s.addToast);

  const addServer = () => {
    try {
      const parsed = JSON.parse(jsonConfig);
      const server: McpServer = {
        id: `mcp_${Date.now()}`,
        name: parsed.name || "Unnamed Server",
        transport: parsed.transport || "stdio",
        command: parsed.command,
        args: parsed.args,
        url: parsed.url,
        env: parsed.env,
        status: "disconnected",
        toolCount: 0,
      };
      const updated = [...servers, server];
      setServers(updated);
      saveServers(updated);
      setShowAdd(false);
      setJsonConfig("");
      addToast({ message: "MCP server added", type: "success" });
    } catch {
      addToast({ message: "Invalid JSON configuration", type: "error" });
    }
  };

  const removeServer = (id: string) => {
    const updated = servers.filter((s) => s.id !== id);
    setServers(updated);
    saveServers(updated);
    addToast({ message: "MCP server removed", type: "success" });
  };

  const StatusIcon = ({ status }: { status: McpServer["status"] }) => {
    switch (status) {
      case "connected": return <CheckCircle size={14} style={{ color: "var(--color-green)" }} />;
      case "error": return <XCircle size={14} style={{ color: "var(--color-red)" }} />;
      default: return <AlertCircle size={14} style={{ color: "var(--text-tertiary)" }} />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            MCP Servers
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Connect Model Context Protocol servers for AI tool integration
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
        >
          <Plus size={12} /> Add Server
        </button>
      </div>

      {/* Add server form */}
      {showAdd && (
        <div className="mb-4 p-4 rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
            Paste your MCP server configuration (Claude Desktop compatible JSON):
          </p>
          <textarea
            value={jsonConfig}
            onChange={(e) => setJsonConfig(e.target.value)}
            placeholder={'{\n  "name": "my-server",\n  "transport": "stdio",\n  "command": "npx",\n  "args": ["-y", "my-mcp-server"]\n}'}
            className="w-full h-32 p-3 rounded-lg border bg-transparent text-xs font-mono outline-none resize-none"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={addServer}
              className="px-3 py-1.5 rounded text-xs"
              style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
            >
              Add Server
            </button>
            <button
              onClick={() => { setShowAdd(false); setJsonConfig(""); }}
              className="px-3 py-1.5 rounded text-xs hover:bg-notion-bg-hover"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 && !showAdd ? (
        <div className="text-center py-8">
          <Server size={32} style={{ color: "var(--text-placeholder)" }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No MCP servers configured</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-placeholder)" }}>
            Add a server to enable AI tool integration
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div key={server.id} className="rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
              <button
                onClick={() => setExpandedId(expandedId === server.id ? null : server.id)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-notion-bg-hover transition-colors rounded-lg"
              >
                <StatusIcon status={server.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {server.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {server.transport} {server.toolCount > 0 && `• ${server.toolCount} tools`}
                  </div>
                </div>
                {expandedId === server.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandedId === server.id && (
                <div className="px-4 pb-3 border-t" style={{ borderColor: "var(--border-default)" }}>
                  <div className="pt-3 space-y-2 text-xs">
                    <div className="flex gap-2">
                      <span className="w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>Transport:</span>
                      <span style={{ color: "var(--text-primary)" }}>{server.transport}</span>
                    </div>
                    {server.command && (
                      <div className="flex gap-2">
                        <span className="w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>Command:</span>
                        <code className="font-mono" style={{ color: "var(--text-primary)" }}>
                          {server.command} {server.args?.join(" ")}
                        </code>
                      </div>
                    )}
                    {server.url && (
                      <div className="flex gap-2">
                        <span className="w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>URL:</span>
                        <span style={{ color: "var(--text-primary)" }}>{server.url}</span>
                      </div>
                    )}
                    {server.error && (
                      <div className="px-2 py-1 rounded text-xs" style={{ backgroundColor: "var(--color-red-bg)", color: "var(--color-red)" }}>
                        {server.error}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <RefreshCw size={10} /> Test Connection
                      </button>
                      <button
                        onClick={() => removeServer(server.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
                        style={{ color: "var(--color-red)" }}
                      >
                        <Trash2 size={10} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
