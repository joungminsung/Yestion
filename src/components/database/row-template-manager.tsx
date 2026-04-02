"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Plus, Trash2, FileText, X, ChevronDown } from "lucide-react";
import type { DatabaseData } from "@/types/database";

type RowTemplateManagerProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  onAddRowFromTemplate: (templateId: string) => void;
};

export function RowTemplateManager({
  databaseId,
  properties,
  onAddRowFromTemplate,
}: RowTemplateManagerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValues, setNewValues] = useState<Record<string, unknown>>({});

  const utils = trpc.useUtils();

  const { data: templates } = trpc.database.listRowTemplates.useQuery(
    { databaseId },
    { enabled: !!databaseId },
  );

  const createTemplate = trpc.database.createRowTemplate.useMutation({
    onSuccess: () => {
      utils.database.listRowTemplates.invalidate();
      setShowCreate(false);
      setNewName("");
      setNewValues({});
    },
  });

  const deleteTemplate = trpc.database.deleteRowTemplate.useMutation({
    onSuccess: () => utils.database.listRowTemplates.invalidate(),
  });

  const editableProperties = properties.filter(
    (p) =>
      !["created_time", "created_by", "last_edited_time", "last_edited_by", "formula", "rollup"].includes(
        p.type,
      ),
  );

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronDown size={12} />
        Templates
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div
            className="absolute right-0 top-full mt-1 w-[260px] rounded-lg z-50 py-1"
            style={{
              backgroundColor: "var(--bg-primary)",
              boxShadow: "var(--shadow-popup)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              className="px-3 py-1.5 text-[10px] uppercase font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Row Templates
            </div>

            {templates?.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-notion-bg-hover group"
              >
                <button
                  onClick={() => {
                    onAddRowFromTemplate(template.id);
                    setShowDropdown(false);
                  }}
                  className="flex items-center gap-2 flex-1 text-sm text-left"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span>{template.icon || <FileText size={14} />}</span>
                  <span className="truncate">{template.name}</span>
                </button>
                <button
                  onClick={() => deleteTemplate.mutate({ id: template.id })}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {(!templates || templates.length === 0) && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                No templates yet
              </div>
            )}

            <div className="mx-2 my-1" style={{ height: "1px", backgroundColor: "var(--border-divider)" }} />

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                style={{ color: "#2383e2" }}
              >
                <Plus size={12} />
                Create template
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Template name..."
                    className="flex-1 text-xs bg-transparent outline-none px-2 py-1 rounded border"
                    style={{
                      color: "var(--text-primary)",
                      borderColor: "var(--border-default)",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => setShowCreate(false)}
                    className="p-1 rounded hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Property value inputs */}
                {editableProperties.slice(0, 5).map((prop) => (
                  <div key={prop.id}>
                    <label className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {prop.name}
                    </label>
                    <input
                      type={prop.type === "number" ? "number" : "text"}
                      value={String(newValues[prop.id] ?? "")}
                      onChange={(e) =>
                        setNewValues((prev) => ({
                          ...prev,
                          [prop.id]:
                            prop.type === "number"
                              ? Number(e.target.value) || 0
                              : e.target.value,
                        }))
                      }
                      className="w-full text-xs bg-transparent outline-none px-2 py-1 rounded border"
                      style={{
                        color: "var(--text-primary)",
                        borderColor: "var(--border-default)",
                      }}
                    />
                  </div>
                ))}

                <button
                  onClick={() =>
                    createTemplate.mutate({
                      databaseId,
                      name: newName || "Untitled template",
                      values: newValues,
                    })
                  }
                  disabled={createTemplate.isPending}
                  className="w-full text-xs px-2 py-1.5 rounded text-white"
                  style={{ backgroundColor: "#2383e2" }}
                >
                  Save template
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
