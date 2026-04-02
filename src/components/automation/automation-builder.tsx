"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, X, Trash2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

type Props = {
  workspaceId: string;
  automationId?: string;
  onClose: () => void;
};

export function AutomationBuilder({ workspaceId, automationId, onClose }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const { data: definitions } = trpc.automation.definitions.useQuery();
  const { data: existing } = trpc.automation.getById.useQuery(
    { id: automationId! },
    { enabled: !!automationId }
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [conditions, setConditions] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [actions, setActions] = useState<{ type: string; config: Record<string, unknown> }[]>([]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || "");
      const trigger = existing.trigger as { type: string; config: Record<string, unknown> };
      setTriggerType(trigger.type);
      setTriggerConfig(trigger.config);
      setConditions((existing.conditions as { field: string; operator: string; value: string }[]) || []);
      setActions((existing.actions as { type: string; config: Record<string, unknown> }[]) || []);
    }
  }, [existing]);

  const createMutation = trpc.automation.create.useMutation({
    onSuccess: () => {
      addToast({ message: "Automation created", type: "success" });
      utils.automation.list.invalidate();
      onClose();
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const updateMutation = trpc.automation.update.useMutation({
    onSuccess: () => {
      addToast({ message: "Automation updated", type: "success" });
      utils.automation.list.invalidate();
      onClose();
    },
    onError: (err) => addToast({ message: err.message, type: "error" }),
  });

  const handleSave = () => {
    if (!name.trim() || !triggerType || actions.length === 0) {
      addToast({ message: "Name, trigger, and at least one action are required", type: "error" });
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger: { type: triggerType, config: triggerConfig },
      conditions,
      actions,
    };

    if (automationId) {
      updateMutation.mutate({ id: automationId, ...data });
    } else {
      createMutation.mutate({ workspaceId, ...data });
    }
  };

  const addAction = () => {
    const firstAction = definitions?.actions[0];
    if (firstAction) {
      setActions([...actions, { type: firstAction.type, config: {} }]);
    }
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="p-1 rounded hover:bg-notion-bg-hover" style={{ color: "var(--text-tertiary)" }}>
          <ArrowLeft size={18} />
        </button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Automation name..."
          className="text-xl font-semibold bg-transparent outline-none flex-1"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full text-sm bg-transparent outline-none mb-6"
        style={{ color: "var(--text-tertiary)" }}
      />

      {/* WHEN — Trigger */}
      <section className="mb-6">
        <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
          When
        </h3>
        <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
          <select
            value={triggerType}
            onChange={(e) => { setTriggerType(e.target.value); setTriggerConfig({}); }}
            className="w-full bg-transparent text-sm outline-none cursor-pointer"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="">Select a trigger...</option>
            {definitions?.triggers.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          {triggerType && (
            <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
              {definitions?.triggers.find((t) => t.type === triggerType)?.description}
            </p>
          )}
        </div>
      </section>

      {/* IF — Conditions */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            If (optional)
          </h3>
          <button onClick={addCondition} className="text-xs hover:underline" style={{ color: "var(--accent-blue)" }}>
            + Add condition
          </button>
        </div>
        {conditions.length > 0 && (
          <div className="space-y-2">
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                <input
                  value={cond.field}
                  onChange={(e) => {
                    const updated = [...conditions];
                    updated[i] = { ...cond, field: e.target.value };
                    setConditions(updated);
                  }}
                  placeholder="Field"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <select
                  value={cond.operator}
                  onChange={(e) => {
                    const updated = [...conditions];
                    updated[i] = { ...cond, operator: e.target.value };
                    setConditions(updated);
                  }}
                  className="bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="gt">greater than</option>
                  <option value="lt">less than</option>
                  <option value="is_empty">is empty</option>
                  <option value="is_not_empty">is not empty</option>
                </select>
                <input
                  value={cond.value}
                  onChange={(e) => {
                    const updated = [...conditions];
                    updated[i] = { ...cond, value: e.target.value };
                    setConditions(updated);
                  }}
                  placeholder="Value"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <button onClick={() => removeCondition(i)} style={{ color: "var(--text-tertiary)" }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* THEN — Actions */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Then
          </h3>
          <button onClick={addAction} className="text-xs hover:underline" style={{ color: "var(--accent-blue)" }}>
            + Add action
          </button>
        </div>
        <div className="space-y-2">
          {actions.map((action, i) => (
            <div key={i} className="p-3 rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium w-5 text-center" style={{ color: "var(--text-tertiary)" }}>
                  {i + 1}.
                </span>
                <select
                  value={action.type}
                  onChange={(e) => {
                    const updated = [...actions];
                    updated[i] = { type: e.target.value, config: {} };
                    setActions(updated);
                  }}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                >
                  {definitions?.actions.map((a) => (
                    <option key={a.type} value={a.type}>{a.label}</option>
                  ))}
                </select>
                <button onClick={() => removeAction(i)} style={{ color: "var(--text-tertiary)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {/* Dynamic config fields based on action type */}
              {definitions?.actions.find((a) => a.type === action.type)?.configSchema &&
                Object.entries(
                  definitions.actions.find((a) => a.type === action.type)!.configSchema
                ).map(([key, schema]) => (
                  <div key={key} className="flex items-center gap-2 ml-7 mt-1">
                    <label className="text-xs w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {schema.label}
                    </label>
                    <input
                      value={String(action.config[key] ?? "")}
                      onChange={(e) => {
                        const updated = [...actions];
                        updated[i] = { ...action, config: { ...action.config, [key]: e.target.value } };
                        setActions(updated);
                      }}
                      className="flex-1 bg-transparent text-sm outline-none px-2 py-1 rounded border"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                      placeholder={schema.label}
                    />
                  </div>
                ))
              }
            </div>
          ))}
          {actions.length === 0 && (
            <button
              onClick={addAction}
              className="w-full p-4 rounded-lg border border-dashed text-sm hover:bg-notion-bg-hover transition-colors"
              style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
            >
              + Add an action
            </button>
          )}
        </div>
      </section>

      {/* Save */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={createMutation.isPending || updateMutation.isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "var(--accent-blue)", color: "white", opacity: (createMutation.isPending || updateMutation.isPending) ? 0.7 : 1 }}
        >
          {automationId ? "Save Changes" : "Create Automation"}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
