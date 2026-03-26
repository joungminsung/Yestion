import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShortcutManager } from "@/lib/shortcuts/manager";

describe("ShortcutManager", () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
  });

  it("should register and trigger a shortcut", () => {
    const handler = vi.fn();
    manager.register({ id: "test", key: "k", meta: true, handler });
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    manager.handleKeyDown(event);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should not trigger when modifier doesn't match", () => {
    const handler = vi.fn();
    manager.register({ id: "test", key: "k", meta: true, handler });
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: false });
    manager.handleKeyDown(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should unregister a shortcut", () => {
    const handler = vi.fn();
    manager.register({ id: "test", key: "k", meta: true, handler });
    manager.unregister("test");
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    manager.handleKeyDown(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should support context-based shortcuts", () => {
    const globalHandler = vi.fn();
    const editorHandler = vi.fn();
    manager.register({ id: "global-save", key: "s", meta: true, handler: globalHandler });
    manager.register({ id: "editor-save", key: "s", meta: true, context: "editor", handler: editorHandler });
    manager.setContext("editor");
    const event = new KeyboardEvent("keydown", { key: "s", metaKey: true });
    manager.handleKeyDown(event);
    expect(editorHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it("should fall back to global when no context match", () => {
    const globalHandler = vi.fn();
    manager.register({ id: "global-action", key: "p", meta: true, handler: globalHandler });
    manager.setContext("editor");
    const event = new KeyboardEvent("keydown", { key: "p", metaKey: true });
    manager.handleKeyDown(event);
    expect(globalHandler).toHaveBeenCalledOnce();
  });
});
